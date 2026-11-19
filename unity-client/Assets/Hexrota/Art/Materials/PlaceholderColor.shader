Shader "Hexrota/PlaceholderColor"
{
    Properties {
        _Color ("Color", Color) = (1,1,1,1)
        _GuideOpacity ("Lesson focus opacity", Range(0,1)) = 1
        _GuideCutout ("Covered interior of a muted floor", Float) = 0
        _RimColor ("Gem edge", Color) = (1,1,1,1)
        _RimWidth ("Gem edge width", Float) = 0
        _FloorMark ("Remaining layer pips or green check", Float) = 0
        _IdleOutline ("Idle hint outline", Float) = 0
        _IdleSheen ("Idle hint sheen", Float) = 0
        _MotionOpacity ("Clear and refill opacity", Range(0,1)) = 1
        _MotionFlash ("Match gleam", Range(0,1)) = 0
        _SpawnCeiling ("Refill segment top (world Y)", Float) = 100000
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
            fixed4 _RimColor;
            float _RimWidth, _FloorMark, _IdleOutline, _IdleSheen, _GuideCutout;
            fixed _GuideOpacity;
            half _MotionOpacity, _MotionFlash;
            float _SpawnCeiling;
            struct appdata { float4 vertex : POSITION; };
            struct v2f { float4 position : SV_POSITION; float2 local : TEXCOORD0; float worldY : TEXCOORD1; };
            v2f vert(appdata input)
            {
                v2f output; output.position = UnityObjectToClipPos(input.vertex);
                output.local = input.vertex.xy;
                output.worldY = mul(unity_ObjectToWorld, input.vertex).y;
                return output;
            }
            float lineDistance(float2 p, float2 start, float2 end)
            {
                float2 span = end-start;
                return length(p-start-span*saturate(dot(p-start,span)/dot(span,span)));
            }
            fixed4 frag(v2f input) : SV_Target
            {
                clip(_MotionOpacity - .005);
                clip(_SpawnCeiling - input.worldY);
                float2 p = abs(input.local);
                float edge = max(p.y, dot(p,float2(.8660254,.5)));
                if (_GuideCutout > 0) clip(edge - _GuideCutout);
                float rim = _RimWidth > 0 ? smoothstep(.485-_RimWidth,.491-_RimWidth,edge) : 0;
                fixed3 color = lerp(_Color.rgb,_RimColor.rgb,rim);
                if (_IdleOutline > 0)
                {
                    fixed3 ink = _IdleOutline > .9 ? fixed3(.945,.902,.698) : fixed3(.839,.906,.710);
                    color = lerp(color,fixed3(1,1,1),_IdleSheen);
                    color = lerp(color,ink,smoothstep(.452,.463,edge)*_IdleOutline*.76);
                }
                if (_FloorMark > 0)
                {
                    // The original SVG places its small floor marks below the gem.
                    float2 at = input.local * (44*.875/.56);
                    if (_FloorMark > 2.5)
                    {
                        float mark = min(lineDistance(at,float2(-4,-29),float2(-1,-32)),lineDistance(at,float2(-1,-32),float2(5,-25)));
                        color = lerp(color,fixed3(.18,.38,.12),1-smoothstep(.8,1.75,mark));
                    }
                    else
                    {
                        float d = distance(float2(abs(at.x),at.y),float2(_FloorMark > 1.5 ? 4 : 0,-31));
                        color = lerp(color,fixed3(.38,.32,.20),1-smoothstep(2.4,3.1,d));
                        color = lerp(color,fixed3(1,.95,.79),1-smoothstep(1.8,2.5,d));
                    }
                }
                return fixed4(lerp(color,fixed3(1,.93,.78),.4*_MotionFlash), _Color.a * _GuideOpacity * _MotionOpacity);
            }
            ENDCG
        }
    }
}
