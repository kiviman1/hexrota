Shader "Hexrota/BoardStone"
{
    // Hand-painted 2D stone sprite with the board's motion and hint effects: refill fade and clip,
    // match gleam, lesson focus fade and the idle hint edge.
    Properties
    {
        [PerRendererData] _MainTex ("Stone sprite", 2D) = "white" {}
        _Color ("Highlight tint", Color) = (1,1,1,1)
        _GuideOpacity ("Lesson focus opacity", Range(0,1)) = 1
        _MotionOpacity ("Clear and refill opacity", Range(0,1)) = 1
        _MotionFlash ("Match gleam", Range(0,1)) = 0
        _SpawnCeiling ("Refill segment top (world Y)", Float) = 100000
        _IdleOutline ("Hint edge", Float) = 0
        _IdleSheen ("Hint glint", Float) = 0
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" "PreviewType"="Plane" "CanUseSpriteAtlas"="True" }
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
            float4 _MainTex_TexelSize;
            fixed4 _Color;
            half _GuideOpacity, _MotionOpacity, _MotionFlash, _IdleOutline, _IdleSheen;
            float _SpawnCeiling;
            struct appdata { float4 vertex : POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; };
            struct v2f { float4 pos : SV_POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; float worldY : TEXCOORD1; };
            v2f vert(appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.color = v.color;
                o.uv = v.uv;
                o.worldY = mul(unity_ObjectToWorld, v.vertex).y;
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                clip(_MotionOpacity - .005);
                clip(_SpawnCeiling - i.worldY);
                fixed4 c = tex2D(_MainTex, i.uv) * i.color;
                c.rgb *= _Color.rgb;
                float2 t = _MainTex_TexelSize.xy * 4;
                half around = min(min(tex2D(_MainTex, i.uv + float2(t.x, 0)).a, tex2D(_MainTex, i.uv - float2(t.x, 0)).a),
                                  min(tex2D(_MainTex, i.uv + float2(0, t.y)).a, tex2D(_MainTex, i.uv - float2(0, t.y)).a));
                half edge = saturate(c.a - around);
                c.rgb = lerp(c.rgb, half3(1, .93, .60), saturate(edge * 2 * _IdleOutline + _IdleSheen));
                c.rgb = lerp(c.rgb, half3(1, .93, .78), .4 * _MotionFlash);
                c.a *= _Color.a * _GuideOpacity * _MotionOpacity;
                return c;
            }
            ENDCG
        }
    }
}
