Shader "Hexrota/PlaceholderColor"
{
    Properties {
        _Color ("Color", Color) = (1,1,1,1)
        _GuideOpacity ("Lesson focus opacity", Range(0,1)) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Pass
        {
            Blend SrcAlpha OneMinusSrcAlpha
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _Color;
            fixed _GuideOpacity;
            struct appdata { float4 vertex : POSITION; };
            struct v2f { float4 position : SV_POSITION; };
            v2f vert(appdata input) { v2f output; output.position = UnityObjectToClipPos(input.vertex); return output; }
            fixed4 frag(v2f input) : SV_Target { return fixed4(_Color.rgb, _Color.a * _GuideOpacity); }
            ENDCG
        }
    }
}
