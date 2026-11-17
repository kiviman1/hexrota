using System;
using System.IO;
using System.Text.Json;
using Hexrota.Client;
using Hexrota.Gameplay;

internal static class Program
{
    private static int Main()
    {
        try
        {
            string root = Directory.GetCurrentDirectory();
            int variants = 0;
            var options = new JsonSerializerOptions { IncludeFields = true };
            for (int level = 1; level <= 10; level++)
            {
                string file = Path.Combine(root, "unity-client", "Assets", "Hexrota", "Resources",
                    "Hexrota", "Levels", "level-" + level + ".json");
                var document = JsonSerializer.Deserialize<HexrotaLevelData>(File.ReadAllText(file), options);
                if (document == null || document.levelId != level || document.variants.Length != 4)
                    throw new Exception("Incorrect Unity level content " + level);
                foreach (HexrotaVariantData variant in document.variants)
                {
                    LevelConfig config = document.Resolve(variant.id);
                    HexMatch.ValidateLevel(config);
                    var game = new HexMatch(config);
                    if (game.Status != "playing" || game.LegalMoves().Count == 0)
                        throw new Exception("Non-playable initial board: " + level + "/" + variant.id);
                    variants++;
                }
            }
            if (variants != 40) throw new Exception("Expected 40 published variants");
            Console.WriteLine("Unity content adapter: 10 levels / 40 variants valid with canonical C# gameplay.");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
