/**
 * Full-frame post-processing: bloom, colour grade and vignette.
 *
 * The bloom is a single-pass filter rather than the usual bright-pass →
 * downsample → separable-blur → composite chain. On a phone the extra render
 * targets cost more than the wider blur is worth, and a 17-tap two-ring
 * gather at the frame's own resolution gives a glow that reads the same at
 * this art scale. Grade and vignette ride along in the same pass, so the
 * whole stack is one extra full-screen draw.
 *
 * The filter is attached to the scene root, not the stage, so the on-screen
 * touch controls stay crisp and unglowed on top of it.
 */
import { Filter, GlProgram, Rectangle, Sprite } from 'pixi.js';

const VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;

uniform float uThreshold;
uniform float uIntensity;
uniform float uRadius;
uniform float uSaturation;
uniform vec3 uShadowTint;
uniform vec3 uLightTint;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

/**
 * Everything above the threshold, squared so the falloff has a soft knee and
 * only genuinely bright things (flame, moonlight, gold) throw a glow.
 */
vec3 brightPass(vec3 c) {
    float l = dot(c, LUMA);
    float k = max(l - uThreshold, 0.0) / max(1.0 - uThreshold, 0.0001);
    return c * k * k;
}

void main(void)
{
    vec4 base = texture(uTexture, vTextureCoord);
    vec2 texel = uInputSize.zw * uRadius;

    vec2 d[8];
    d[0] = vec2( 1.000,  0.000); d[1] = vec2(-1.000,  0.000);
    d[2] = vec2( 0.000,  1.000); d[3] = vec2( 0.000, -1.000);
    d[4] = vec2( 0.707,  0.707); d[5] = vec2(-0.707,  0.707);
    d[6] = vec2( 0.707, -0.707); d[7] = vec2(-0.707, -0.707);

    // Two rings: a tight one for the core glow, a wide one for the halo.
    vec3 glow = brightPass(base.rgb) * 0.18;
    for (int i = 0; i < 8; i++) {
        glow += brightPass(texture(uTexture, vTextureCoord + d[i] * texel).rgb) * 0.075;
        glow += brightPass(texture(uTexture, vTextureCoord + d[i] * texel * 2.5).rgb) * 0.040;
    }

    vec3 col = base.rgb + glow * uIntensity;

    // Grade: pull saturation, then split-tone shadows cool and lights warm.
    float l = dot(col, LUMA);
    col = mix(vec3(l), col, uSaturation);
    col *= mix(uShadowTint, uLightTint, clamp(l, 0.0, 1.0));

    finalColor = vec4(clamp(col, 0.0, 1.0), base.a);
}
`;

/** Convert 0xRRGGBB to a normalised rgb triple. */
function rgb(hex) {
    return new Float32Array([
        ((hex >> 16) & 255) / 255,
        ((hex >> 8) & 255) / 255,
        (hex & 255) / 255,
    ]);
}

export class PostFX {
    /**
     * @param {import('../main.js').Game} game
     * @param {import('pixi.js').Container} target container the filter wraps
     * @param {import('pixi.js').Container} overlayLayer where the vignette goes
     */
    constructor(game, target, overlayLayer) {
        this.game = game;
        this.target = target;
        this.enabled = false;

        this.filter = new Filter({
            glProgram: GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: 'lotbw-postfx' }),
            resources: {
                postUniforms: {
                    // Lit sand sits at ~0.82 luma and midday foliage not far
                    // below, so the knee has to clear diffuse surfaces or the
                    // whole ground blooms. Only light sources, white foam,
                    // metal highlights and the moon get past this.
                    uThreshold: { value: 0.84, type: 'f32' },
                    uIntensity: { value: 0.7, type: 'f32' },
                    uRadius: { value: 2.4, type: 'f32' },
                    uSaturation: { value: 1.06, type: 'f32' },
                    uShadowTint: { value: rgb(0x8f9ec4), type: 'vec3<f32>' },
                    uLightTint: { value: rgb(0xfff4dc), type: 'vec3<f32>' },
                },
            },
        });

        // The vignette is a stretched radial sprite rather than a shader term,
        // because the filter's texture coordinates are frame-relative and this
        // is both exact and free.
        this.vignette = new Sprite(game.art.tex('fx:vignette'));
        this.vignette.blendMode = 'multiply';
        this.vignette.alpha = 0.7;
        // Decoration only. Without this the sprite covers the whole stage and
        // swallows every hit test beneath it, which makes the entire game
        // untappable — Pixi hit-tests a Sprite by its bounds regardless of it
        // never emitting events itself.
        this.vignette.eventMode = 'none';
        overlayLayer.addChildAt(this.vignette, 0);

        this.resize(game.width, game.height);
        this.apply();
    }

    get uniforms() {
        return this.filter.resources.postUniforms.uniforms;
    }

    /** Attach or detach the filter to match the current quality tier. */
    apply() {
        const want = this.game.quality.bloom;
        if (want === this.enabled) return;
        this.enabled = want;
        this.target.filters = want ? [this.filter] : [];
    }

    /**
     * Bloom reach scales with the tier: a lower tier gathers from closer in,
     * which is cheaper to sample and reads as a tighter glow rather than a
     * missing one.
     */
    refresh() {
        this.apply();
        const q = this.game.quality;
        this.uniforms.uRadius = 2.4 * (q.bloomScale / 0.5);
        this.uniforms.uIntensity = q.bloomPasses > 1 ? 0.7 : 0.55;
    }

    resize(w, h) {
        // An explicit filter area avoids Pixi measuring the whole scene graph
        // every frame, and is what we want anyway: the effect is full-screen.
        this.target.filterArea = new Rectangle(0, 0, w, h);
        this.vignette.width = w;
        this.vignette.height = h;
    }

    /** Push the world a little warmer/darker, e.g. at night or in a storm. */
    setGrade({ saturation, shadowTint, lightTint } = {}) {
        if (saturation !== undefined) this.uniforms.uSaturation = saturation;
        if (shadowTint !== undefined) this.uniforms.uShadowTint.set(rgb(shadowTint));
        if (lightTint !== undefined) this.uniforms.uLightTint.set(rgb(lightTint));
    }
}
