Shader "Hidden/Hexrota/DialogSnapshot"
{
    Properties { _MainTex ("Screen", 2D) = "black" {} }
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
            fixed4 frag(v2f_img input) : SV_Target
            {
                float2 t = abs(_MainTex_TexelSize.xy);
                half3 color = 4 * tex2D(_MainTex, input.uv).rgb;
                color += tex2D(_MainTex, input.uv + float2(t.x, t.y)).rgb;
                color += tex2D(_MainTex, input.uv + float2(-t.x, t.y)).rgb;
                color += tex2D(_MainTex, input.uv + float2(t.x, -t.y)).rgb;
                color += tex2D(_MainTex, input.uv - t).rgb;
                // A swapchain supplies RGB. Alpha may be zero on D3D and mobile.
                return fixed4(color * .125, 1);
            }
            ENDCG
        }
    }
}
