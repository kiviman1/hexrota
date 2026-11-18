Shader "Hexrota/BoardDigit"
{
    Properties { _MainTex ("Font atlas", 2D) = "white" {} }
    SubShader
    {
        // Write only the numeral's ink into depth before the hexagons. In a
        // faded tutorial tile this reproduces SVG group opacity in one blend.
        Tags { "Queue"="Geometry-10" "RenderType"="TransparentCutout" }
        Pass
        {
            Cull Off
            ZWrite On
            Blend SrcAlpha OneMinusSrcAlpha
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            struct inputData { float4 vertex : POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; };
            struct vertexData { float4 vertex : SV_POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; };
            vertexData vert(inputData v)
            {
                vertexData o; o.vertex = UnityObjectToClipPos(v.vertex); o.color = v.color; o.uv = v.uv; return o;
            }
            fixed4 frag(vertexData i) : SV_Target
            {
                fixed alpha = tex2D(_MainTex,i.uv).a;
                clip(alpha - .18);
                return fixed4(i.color.rgb, i.color.a*alpha);
            }
            ENDCG
        }
    }
}
