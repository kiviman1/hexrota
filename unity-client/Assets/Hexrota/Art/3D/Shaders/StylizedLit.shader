// Stylised lit shader for the painted-look 3D props (the coop levels).
//   colour = albedo x (ambient x purple-tinted shadow side + warm key light x wrap lambert)
//          x ground AO near the base + a thin warm rim on the lit side,
//   then a light saturation / contrast grade so the wood reads against the soil.
// No Unity lights are used: the key light direction/colour come from material properties, which
// CoopModelView fills from a CoopLook asset. Built-in pipeline; the same maths ports to a URP
// unlit-style HLSL pass without changes.
Shader "Hexrota/Stylized Lit"
{
    Properties
    {
        _MainTex ("Albedo", 2D) = "white" {}
        _LightDir ("Key light direction (world, towards the light)", Vector) = (0.5, 0.75, 0.45, 0)
        _LightColor ("Key light colour", Color) = (1, 0.94, 0.82, 1)
        _LightIntensity ("Key light intensity", Range(0, 2)) = 0.45
        _Wrap ("Wrap (soft lambert)", Range(0, 1)) = 0.5
        _Ambient ("Ambient", Color) = (0.78, 0.76, 0.8, 1)
        _ShadowColor ("Shadow side tint", Color) = (0.227, 0.102, 0.345, 1)
        _ShadowStrength ("Shadow tint strength", Range(0, 1)) = 0.3
        _RimColor ("Rim colour", Color) = (1, 0.85, 0.6, 1)
        _RimStrength ("Rim strength", Range(0, 1)) = 0.18
        _RimPower ("Rim width (higher = thinner)", Range(0.5, 8)) = 3.5
        _GroundAO ("Ground AO (darkening at the base)", Range(0, 1)) = 0.35
        _GroundAOHeight ("Ground AO height (m)", Range(0.01, 0.5)) = 0.12
        _Saturation ("Saturation", Range(0, 2)) = 1.12
        _Contrast ("Contrast", Range(0.5, 1.5)) = 1.06
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex; float4 _MainTex_ST;
            float4 _LightDir; fixed4 _LightColor; half _LightIntensity, _Wrap;
            fixed4 _Ambient, _ShadowColor; half _ShadowStrength;
            fixed4 _RimColor; half _RimStrength, _RimPower;
            half _GroundAO, _GroundAOHeight, _Saturation, _Contrast;

            struct appdata { float4 vertex : POSITION; float3 normal : NORMAL; float2 uv : TEXCOORD0; };
            struct v2f
            {
                float4 pos : SV_POSITION; float2 uv : TEXCOORD0;
                float3 normal : TEXCOORD1; float3 view : TEXCOORD2; float height : TEXCOORD3;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.normal = UnityObjectToWorldNormal(v.normal);
                float3 world = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.view = _WorldSpaceCameraPos - world;
                o.height = v.vertex.y; // metres above the model's ground (pivot at ground level)
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed3 albedo = tex2D(_MainTex, i.uv).rgb;
                float3 n = normalize(i.normal), l = normalize(_LightDir.xyz), v = normalize(i.view);
                half ndl = saturate((dot(n, l) + _Wrap) / (1 + _Wrap));
                half3 shadowTint = lerp(half3(1, 1, 1), _ShadowColor.rgb, _ShadowStrength);
                half3 light = _Ambient.rgb * lerp(shadowTint, half3(1, 1, 1), ndl) + _LightColor.rgb * _LightIntensity * ndl;
                half ao = lerp(1 - _GroundAO, 1, saturate(i.height / _GroundAOHeight));
                half rim = pow(1 - saturate(dot(n, v)), _RimPower) * _RimStrength * ndl;
                half3 c = albedo * light * ao + _RimColor.rgb * rim;
                half luma = dot(c, half3(0.299, 0.587, 0.114));
                c = lerp(luma.xxx, c, _Saturation);
                c = (c - 0.5) * _Contrast + 0.5;
                return fixed4(saturate(c), 1);
            }
            ENDCG
        }
    }
}
