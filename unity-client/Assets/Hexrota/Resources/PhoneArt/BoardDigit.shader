Shader "Hexrota/BoardDigit"
{
    Properties
    {
        _MainTex ("Font atlas", 2D) = "white" {}
        _MotionOpacity ("Clear and refill opacity", Range(0,1)) = 1
        _SpawnCeiling ("Refill segment top (world Y)", Float) = 100000
    }
    SubShader
    {
        // Numerals are drawn after the 2D stone sprites (renderer sorting order), white over a dark outline.
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        Pass
        {
            Cull Off
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            half _MotionOpacity;
            float _SpawnCeiling;
            struct inputData { float4 vertex : POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; };
            struct vertexData { float4 vertex : SV_POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; float worldY : TEXCOORD1; };
            vertexData vert(inputData v)
            {
                vertexData o; o.vertex = UnityObjectToClipPos(v.vertex); o.color = v.color; o.uv = v.uv;
                o.worldY = mul(unity_ObjectToWorld, v.vertex).y;
                return o;
            }
            fixed4 frag(vertexData i) : SV_Target
            {
                fixed alpha = tex2D(_MainTex,i.uv).a;
                clip(min(alpha - .02, _MotionOpacity - .005));
                clip(_SpawnCeiling - i.worldY);
                return fixed4(i.color.rgb, i.color.a*alpha*_MotionOpacity);
            }
            ENDCG
        }
    }
}
