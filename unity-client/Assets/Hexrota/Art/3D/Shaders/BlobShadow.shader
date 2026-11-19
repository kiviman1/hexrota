// Soft fake contact shadow: a radial falloff drawn on a ground quad, output premultiplied so it
// composites correctly into the coop's transparent render texture.
Shader "Hexrota/Blob Shadow"
{
    Properties
    {
        _Color ("Shadow (rgb) and opacity (a)", Color) = (0,0,0,0.35)
        _Softness ("Edge softness", Range(0.01, 1)) = 0.6
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent-10" }
        ZWrite Off
        Blend One OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _Color; float _Softness;
            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
            v2f vert (appdata v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.uv * 2 - 1; return o; }
            fixed4 frag (v2f i) : SV_Target
            {
                float d = length(i.uv);
                float a = _Color.a * (1 - smoothstep(1 - _Softness, 1, d));
                return fixed4(_Color.rgb * a, a);
            }
            ENDCG
        }
    }
}
