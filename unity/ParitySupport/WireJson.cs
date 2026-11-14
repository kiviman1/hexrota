using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using Hexrota.Contracts;

namespace Hexrota.ParitySupport
{
    // .NET test-host adapter only. The reusable core never references System.Text.Json.
    public static class WireJson
    {
        public static object Parse(string json)
        {
            using (JsonDocument document = JsonDocument.Parse(json)) return Read(document.RootElement);
        }
        public static object Read(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    var map = new Dictionary<string, object>(StringComparer.Ordinal);
                    foreach (JsonProperty property in element.EnumerateObject()) map[property.Name] = Read(property.Value);
                    return map;
                case JsonValueKind.Array:
                    var list = new List<object>(); foreach (JsonElement item in element.EnumerateArray()) list.Add(Read(item)); return list;
                case JsonValueKind.String: return element.GetString();
                case JsonValueKind.True: return true;
                case JsonValueKind.False: return false;
                case JsonValueKind.Number:
                    long integer; return element.TryGetInt64(out integer) ? (object)integer : element.GetDouble();
                case JsonValueKind.Null: return null;
                default: throw new ArgumentException("Unsupported JSON wire kind");
            }
        }
        public static string Serialize(object value)
        {
            using (var stream = new MemoryStream())
            {
                using (var writer = new Utf8JsonWriter(stream)) { Write(writer, value); writer.Flush(); }
                return Encoding.UTF8.GetString(stream.ToArray());
            }
        }
        public static void Write(Utf8JsonWriter writer, object value)
        {
            if (value == null) { writer.WriteNullValue(); return; }
            if (value is string) { writer.WriteStringValue((string)value); return; }
            if (value is bool) { writer.WriteBooleanValue((bool)value); return; }
            if (Wire.IsNumber(value))
            {
                if (value is long) writer.WriteNumberValue((long)value);
                else if (value is ulong) writer.WriteNumberValue((ulong)value);
                else if (value is uint) writer.WriteNumberValue((uint)value);
                else if (value is int) writer.WriteNumberValue((int)value);
                else if (value is decimal) writer.WriteNumberValue((decimal)value);
                else writer.WriteNumberValue(Wire.Number(value));
                return;
            }
            if (Wire.IsMap(value))
            {
                writer.WriteStartObject();
                foreach (var property in Wire.Map(value)) { writer.WritePropertyName(property.Key); Write(writer, property.Value); }
                writer.WriteEndObject(); return;
            }
            if (Wire.IsList(value))
            {
                writer.WriteStartArray(); foreach (object item in Wire.List(value)) Write(writer, item); writer.WriteEndArray(); return;
            }
            throw new ArgumentException("Unsupported JSON output type: " + value.GetType().FullName);
        }
    }
}
