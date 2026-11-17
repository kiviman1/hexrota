using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Hexrota.UnityClient
{
    // JObject is never passed into the core. Match the parity host's JSON value algebra.
    public static class WireJsonCodec
    {
        public static object Parse(string json)
        {
            using (var reader = new JsonTextReader(new StringReader(json)))
            {
                reader.DateParseHandling = DateParseHandling.None;
                reader.FloatParseHandling = FloatParseHandling.Double;
                var token = JToken.Load(reader, new JsonLoadSettings { DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error });
                if (reader.Read()) throw new FormatException("Trailing JSON content");
                return Read(token);
            }
        }
        private static object Read(JToken token)
        {
            switch (token.Type)
            {
                case JTokenType.Object:
                    var map = new Dictionary<string, object>(StringComparer.Ordinal);
                    foreach (var property in ((JObject)token).Properties()) map.Add(property.Name, Read(property.Value));
                    return map;
                case JTokenType.Array:
                    var list = new List<object>(); foreach (var item in (JArray)token) list.Add(Read(item)); return list;
                case JTokenType.Integer: return Convert.ToInt64(((JValue)token).Value, CultureInfo.InvariantCulture);
                case JTokenType.Float:
                    var number = (double)token; if (double.IsNaN(number) || double.IsInfinity(number)) throw new FormatException("Non-finite JSON number"); return number;
                case JTokenType.String: return (string)token;
                case JTokenType.Boolean: return (bool)token;
                case JTokenType.Null: return null;
                default: throw new FormatException("Unsupported JSON token: " + token.Type);
            }
        }
        public static string Serialize(object value) { return JsonConvert.SerializeObject(value, Formatting.None); }
    }
}
