Shader "Hidden/Hexrota/DialogSnapshot"
{
    Properties
    {
        _MainTex ("Screen", 2D) = "black" {}
        _Scrim ("Overlay", Color) = (0.063,0.04,0.161,0.74)
    }
    SubShader
    {
        Cull Off ZWrite Off ZTest Always
        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            float4 _MainTex_TexelSize;
            fixed4 _Scrim;
            fixed4 frag(v2f_img input) : SV_Target
            {
                float2 t = abs(_MainTex_TexelSize.xy);
                half3 color = 4 * tex2D(_MainTex, input.uv).rgb;
                color += tex2D(_MainTex, input.uv + float2(t.x, t.y)).rgb;
                color += tex2D(_MainTex, input.uv + float2(-t.x, t.y)).rgb;
                color += tex2D(_MainTex, input.uv + float2(t.x, -t.y)).rgb;
                color += tex2D(_MainTex, input.uv - t).rgb;
                // A swapchain supplies RGB. Alpha may be zero on D3D and mobile.
                color *= .125;
                // Some suspended or hidden windows have no readable backbuffer.
                // A transparent sample lets the native scrim show the actual game.
                half valid = step(.002, max(max(color.r, color.g), color.b));
                return fixed4(lerp(color, _Scrim.rgb, _Scrim.a), valid);
            }
            ENDCG
        }
    }
}
