Shader "Hexrota/Castle Board Facet"
{
    Properties
    {
        _MainTex ("Base color", 2D) = "white" {}
        _Pigment ("Surface tint", Color) = (1,1,1,1)
        _Color ("Highlight tint", Color) = (1,1,1,1)
        _Lustre ("Bevel glint", Range(0,1)) = 0.32
        _GuideOpacity ("Lesson focus opacity", Range(0,1)) = 1
        _MotionOpacity ("Clear and refill opacity", Range(0,1)) = 1
        _MotionFlash ("Match gleam", Range(0,1)) = 0
        _SpawnCeiling ("Refill segment top (world Y)", Float) = 100000
        _GuideCutout ("Covered face during lesson fade", Float) = 0
        _FloorMark ("Floor indicator", Float) = 0
        _IdleOutline ("Hint edge", Float) = 0
        _IdleSheen ("Hint glint", Float) = 0
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
            sampler2D _MainTex;
            fixed4 _Pigment, _Color;
            half _MotionOpacity, _MotionFlash;
            float _SpawnCeiling;
            half _Lustre, _GuideOpacity, _GuideCutout, _FloorMark, _IdleOutline, _IdleSheen;
            struct VertexData { float4 vertex : POSITION; float3 normal : NORMAL; float2 uv : TEXCOORD0; };
            struct FragmentData { float4 pos : SV_POSITION; half3 normal : TEXCOORD0; float2 uv : TEXCOORD1; float2 plane : TEXCOORD2; float worldY : TEXCOORD3; };
            FragmentData vert(VertexData v)
            {
                FragmentData o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.normal = UnityObjectToWorldNormal(v.normal);
                o.uv = v.uv;
                o.plane = v.vertex.xz;
                o.worldY = mul(unity_ObjectToWorld, v.vertex).y;
                return o;
            }
            half segmentDistance(float2 p, float2 a, float2 b)
            {
                float2 dir = b-a;
                return length(p-a-dir*saturate(dot(p-a,dir)/dot(dir,dir)));
            }
            fixed4 frag(FragmentData i) : SV_Target
            {
                clip(_MotionOpacity - .005);
                clip(_SpawnCeiling - i.worldY);
                float2 p = abs(i.plane);
                float hex = max(p.y, dot(p,float2(.8660254,.5)));
                if (_GuideCutout > 0) clip(hex - _GuideCutout);
                half3 n = normalize(i.normal);
                half3 light = normalize(half3(-.43,.58,-.70));
                half3 halfway = normalize(light + half3(0,0,-1));
                half3 base = tex2D(_MainTex,i.uv).rgb * _Pigment.rgb * _Color.rgb;
                half3 lit = base * (.76 + .28*saturate(dot(n,light)));
                lit += _Lustre * pow(saturate(dot(n,halfway)),30) * half3(1,.92,.74);
                lit = lerp(lit,half3(1,.93,.60),
                    saturate((1-saturate(-n.z)) * _IdleOutline + _IdleSheen));
                if (_FloorMark > 0)
                {
                    float2 at = i.plane - float2(0,-.383);
                    if (_FloorMark > 2.5)
                    {
                        float d = min(segmentDistance(at,float2(-.052,.005),float2(-.020,-.020)),
                                      segmentDistance(at,float2(-.020,-.020),float2(.048,.025)));
                        lit = lerp(lit,half3(.12,.28,.10),1-smoothstep(.010,.016,d));
                    }
                    else
                    {
                        float d = length(float2(abs(at.x)-(_FloorMark > 1.5 ? .045 : 0),at.y));
                        lit = lerp(lit,half3(.38,.20,.09),1-smoothstep(.023,.029,d));
                        lit = lerp(lit,half3(1,.91,.66),1-smoothstep(.015,.022,d));
                    }
                }
                return fixed4(lerp(lit,half3(1,.93,.78),.4*_MotionFlash), _Color.a*_GuideOpacity*_MotionOpacity);
            }
            ENDCG
        }
    }
}
