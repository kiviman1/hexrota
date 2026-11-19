using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Hexrota.Contracts;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Economy
{
    // Pure JSON wire contract. Callers derive verified wins from replay and commit
    // the returned copy with game/lives/commands in one profile transaction.
    public sealed class EconomyManager
    {
        private static readonly string[] Items = { "greenBrush", "colorKey" };
        private const string WelcomeVersion = "onboarding-v1";
        // A published grant version keeps its historical value when prices change.
        private const long WelcomeGold = 20;
        private static readonly string[] LegacyKeys = { "hexrota-match-v5", "hexrota-match-v4", "hexrota-match-v3", "hexrota-match-v2" };
        private readonly Dictionary<string, object> configuration;
        private readonly List<object> levels;
        private readonly List<object> tutorials;
        private static void Need(bool condition, string code) { if (!condition) W.Fail(code, code); }
        private static bool Exact(object value, params string[] fields) { return W.IsMap(value) && W.Map(value).Count == fields.Length && fields.All(field => W.Has(value, field)); }
        private static bool Int(object value) { return W.IsSafeInteger(value) && W.Number(value) >= 0; }
        private static bool Token(object value)
        {
            string text = value as string;
            return text != null && Regex.IsMatch(text, "\\A[A-Za-z0-9_.:-]{1,180}\\z") && text != "__proto__" && text != "prototype" && text != "constructor";
        }
        private static object Get(object value, string key) { return W.Get(value, key); }
        private static long Number(object value) { return W.Integer(value); }
        private static bool Is(object value, object other) { return W.Equal(value, other); }
        private static bool Includes(List<object> values, object value) { return values.Any(entry => Is(entry, value)); }
        private static List<object> Array(object value) { return W.List(value); }
        private static Dictionary<string, object> Map(object value) { return W.Map(value); }
        private static long N(object value, string key) { return Number(Get(value, key)); }
        private static void Add(Dictionary<string, object> value, string key, long amount) { value[key] = N(value, key) + amount; }

        public EconomyManager(Dictionary<string, object> config = null)
        {
            configuration = W.Copy(config ?? EconomyDefaults.Create()); ValidateConfig(configuration);
            levels = Array(configuration["levelIds"]); tutorials = Array(configuration["tutorialIds"]);
        }
        public static bool ValidateConfig(object config)
        {
            const string error = "invalid_economy_config";
            Need((Exact(config, "schemaVersion", "rulesVersion", "pricesVersion", "campaignId", "levelIds", "tutorialIds", "tutorialCount", "reward", "inventory", "rescue", "botanical") || Exact(config, "schemaVersion", "rulesVersion", "pricesVersion", "campaignId", "levelIds", "tutorialIds", "tutorialCount", "reward", "inventory", "rescue", "botanical", "welcome")) && Is(Get(config, "schemaVersion"), 1) && Is(Get(config, "rulesVersion"), "economy-v1") && Token(Get(config, "pricesVersion")) && Token(Get(config, "campaignId")), error);
            if (W.Has(config, "welcome")) Need(Exact(Get(config, "welcome"), "version", "gold") && Is(Get(Get(config, "welcome"), "version"), WelcomeVersion) && Is(Get(Get(config, "welcome"), "gold"), WelcomeGold), error);
            object levelData = Get(config, "levelIds"), tutorialData = Get(config, "tutorialIds");
            Need(W.IsList(levelData) && Array(levelData).Count > 0 && Array(levelData).Select((id, index) => Int(id) && Number(id) > 0 && (index == 0 || Number(id) > Number(Array(levelData)[index - 1]))).All(value => value) && W.IsList(tutorialData) && Array(tutorialData).Count == 2 && Array(tutorialData).All(Token) && !Is(Array(tutorialData)[0], Array(tutorialData)[1]) && Is(Get(config, "tutorialCount"), 2), error);
            object reward = Get(config, "reward"), inventory = Get(config, "inventory");
            Need(Exact(reward, "gold", "stars") && Is(Get(reward, "gold"), 20) && Is(Get(reward, "stars"), 1) && Exact(inventory, Items), error);
            foreach (string item in Items)
            {
                object entry = Get(inventory, item);
                Need(Exact(entry, "unlockAfterLevelId", "gift", "costGold", "maxPerAttempt") && Includes(Array(levelData), Get(entry, "unlockAfterLevelId")) && Is(Get(entry, "gift"), 3) && Int(Get(entry, "costGold")) && N(entry, "costGold") > 0 && Int(Get(entry, "maxPerAttempt")) && N(entry, "maxPerAttempt") > 0 && N(entry, "maxPerAttempt") <= 10, error);
            }
            Need(Is(Get(Get(inventory, "greenBrush"), "unlockAfterLevelId"), 3) && Is(Get(Get(inventory, "colorKey"), "unlockAfterLevelId"), 6), error);
            object rescue = Get(config, "rescue"), botanical = Get(config, "botanical");
            Need(Exact(rescue, "moves", "goldCost", "dailyAdLimit", "maxPerAttempt") && Is(Get(rescue, "moves"), 5) && Int(Get(rescue, "goldCost")) && N(rescue, "goldCost") > 0 && Int(Get(rescue, "dailyAdLimit")) && N(rescue, "dailyAdLimit") > 0 && Is(Get(rescue, "maxPerAttempt"), 1), error);
            int[] thresholds = { 2, 5, 8, 10 }; string[] ids = { "flowers", "plants", "trees", "complete" };
            Need(W.IsList(botanical) && Array(botanical).Count == 4 && Array(botanical).Select((entry, index) => Exact(entry, "stars", "id") && Is(Get(entry, "stars"), thresholds[index]) && Is(Get(entry, "id"), ids[index])).All(value => value), error); return true;
        }
        private bool Known(object id) { return W.IsSafeInteger(id) && Includes(levels, id); }
        private List<object> Sorted(List<object> values) { return levels.Where(id => Includes(values, id)).ToList(); }
        private bool IdList(object value) { return W.IsList(value) && Array(value).All(Known) && Is(value, Sorted(Array(value))); }
        private object Next(List<object> cleared) { return levels.FirstOrDefault(id => !Includes(cleared, id)); }
        private string ClearId(object id) { return "clear:" + configuration["campaignId"] + ":" + W.JsString(id); }
        private string GiftId(object id, string item) { return "gift:" + configuration["campaignId"] + ":" + W.JsString(id) + ":" + item; }
        private string WelcomeId() { return "welcome:" + configuration["campaignId"] + ":" + WelcomeVersion; }
        private Dictionary<string, object> Item(string id) { return Map(Get(configuration["inventory"], id)); }
        private static Dictionary<string, object> EmptyInventory() { return W.Obj("greenBrush", 0, "colorKey", 0); }
        public Dictionary<string, object> Config() { return W.Copy(configuration); }
        public Dictionary<string, object> CreateState()
        {
            return W.Obj("schemaVersion", 1, "rulesVersion", "economy-v1", "campaignId", configuration["campaignId"], "clearedLevelIds", W.Arr(), "claimedLevelIds", W.Arr(), "gold", 0, "stars", 0, "inventory", EmptyInventory(), "migration", W.Obj("schemaVersion", 1, "source", "new", "recognizedLevelIds", W.Arr(), "verifiedLevelIds", W.Arr()), "transactions", W.Obj());
        }
        public bool Validate(object state)
        {
            Need(Exact(state, "schemaVersion", "rulesVersion", "campaignId", "clearedLevelIds", "claimedLevelIds", "gold", "stars", "inventory", "migration", "transactions") && Is(Get(state, "schemaVersion"), 1) && Is(Get(state, "rulesVersion"), "economy-v1") && Is(Get(state, "campaignId"), configuration["campaignId"]) && IdList(Get(state, "clearedLevelIds")) && IdList(Get(state, "claimedLevelIds")) && Int(Get(state, "gold")) && Int(Get(state, "stars")) && Exact(Get(state, "inventory"), Items) && Items.All(item => Int(Get(Get(state, "inventory"), item))) && W.IsMap(Get(state, "transactions")), "invalid_economy_state");
            object migration = Get(state, "migration");
            Need(Exact(migration, "schemaVersion", "source", "recognizedLevelIds", "verifiedLevelIds") && Is(Get(migration, "schemaVersion"), 1) && (Is(Get(migration, "source"), "new") || LegacyKeys.Any(key => Is(Get(migration, "source"), key))) && IdList(Get(migration, "recognizedLevelIds")) && IdList(Get(migration, "verifiedLevelIds")) && Array(Get(migration, "verifiedLevelIds")).All(id => Includes(Array(Get(migration, "recognizedLevelIds")), id)) && (!Is(Get(migration, "source"), "new") || Array(Get(migration, "recognizedLevelIds")).Count == 0), "invalid_economy_migration");
            var cleared = Array(W.Clone(Get(migration, "recognizedLevelIds"))); var claimed = W.Arr(); var gifts = new HashSet<string>(StringComparer.Ordinal); var usage = new Dictionary<string, long>(StringComparer.Ordinal); var inventory = EmptyInventory(); long gold = 0, stars = 0;
            var rows = Map(Get(state, "transactions")).ToList();
            Need(rows.All(pair => Token(pair.Key) && Exact(pair.Value, "kind", "levelId", "attemptId", "itemId", "source", "assisted", "sequence", "costGold", "pricesVersion") && Int(Get(pair.Value, "sequence")) && N(pair.Value, "sequence") > 0), "invalid_economy_ledger");
            rows.Sort((a, b) => N(a.Value, "sequence").CompareTo(N(b.Value, "sequence")));
            for (int index = 0; index < rows.Count; index++)
            {
                string id = rows[index].Key; object row = rows[index].Value; object level = Get(row, "levelId"), attempt = Get(row, "attemptId"), itemValue = Get(row, "itemId"); string item = itemValue as string; object priceVersion = Get(row, "pricesVersion");
                Need(N(row, "sequence") == index + 1 && Get(row, "assisted") is bool && Int(Get(row, "costGold")) && (priceVersion == null || Token(priceVersion)), "invalid_economy_ledger");
                long cost = N(row, "costGold");
                if (Is(Get(row, "kind"), "clear"))
                {
                    Need(Known(level) && Token(attempt) && itemValue == null && cost == 0 && priceVersion == null && id == ClearId(level) && !Includes(claimed, level) && (Is(Get(row, "source"), "gameplay") || Is(Get(row, "source"), "legacy")), "invalid_economy_ledger");
                    Need(Is(Get(row, "source"), "legacy") ? Includes(Array(Get(migration, "verifiedLevelIds")), level) : Is(Next(cleared), level), "invalid_economy_ledger");
                    if (!Includes(cleared, level)) cleared.Add(level); claimed.Add(level); gold += N(configuration["reward"], "gold"); stars += N(configuration["reward"], "stars");
                }
                else if (Is(Get(row, "kind"), "welcome"))
                {
                    Need(id == WelcomeId() && level == null && Token(attempt) && itemValue == null && Is(Get(row, "source"), "onboarding") && Is(Get(row, "assisted"), false) && cost == 0 && Is(priceVersion, WelcomeVersion), "invalid_economy_ledger");
                    gold += WelcomeGold;
                }
                else if (Is(Get(row, "kind"), "gift"))
                {
                    Need(Items.Contains(item) && Is(level, Get(Item(item), "unlockAfterLevelId")) && Includes(claimed, level) && Token(attempt) && Is(attempt, Get(Get(state, "transactions"), ClearId(level)) == null ? null : Get(Get(Get(state, "transactions"), ClearId(level)), "attemptId")) && Is(Get(row, "assisted"), Get(Get(Get(state, "transactions"), ClearId(level)), "assisted")) && Is(Get(row, "source"), "milestone") && cost == 0 && priceVersion == null && id == GiftId(level, item) && !gifts.Contains(item), "invalid_economy_ledger"); gifts.Add(item); Add(inventory, item, N(Item(item), "gift"));
                }
                else if (Is(Get(row, "kind"), "purchase"))
                {
                    Need(!id.StartsWith("clear:", StringComparison.Ordinal) && !id.StartsWith("gift:", StringComparison.Ordinal) && Items.Contains(item) && Includes(cleared, Get(Item(item), "unlockAfterLevelId")) && level == null && attempt == null && Is(Get(row, "source"), "command") && Is(Get(row, "assisted"), false) && Is(priceVersion, configuration["pricesVersion"]) && cost == N(Item(item), "costGold") && gold >= cost, "invalid_economy_ledger"); gold -= cost; Add(inventory, item, 1);
                }
                else if (Is(Get(row, "kind"), "use") || Is(Get(row, "kind"), "rescue"))
                {
                    Need(!id.StartsWith("clear:", StringComparison.Ordinal) && !id.StartsWith("gift:", StringComparison.Ordinal) && Known(level) && Is(level, Next(cleared)) && Token(attempt) && Is(Get(row, "source"), "command") && Is(Get(row, "assisted"), true), "invalid_economy_ledger");
                    bool rescue = Is(Get(row, "kind"), "rescue"); string key = (string)attempt + ":" + (rescue ? "rescue" : W.JsString(itemValue)); long count; usage.TryGetValue(key, out count);
                    if (!rescue) { Need(Items.Contains(item) && Includes(cleared, Get(Item(item), "unlockAfterLevelId")) && Number(level) > N(Item(item), "unlockAfterLevelId") && cost == 0 && priceVersion == null && N(inventory, item) > 0 && count < N(Item(item), "maxPerAttempt"), "invalid_economy_ledger"); Add(inventory, item, -1); }
                    else { Need(item == "rescue5" && Is(priceVersion, configuration["pricesVersion"]) && cost == N(configuration["rescue"], "goldCost") && gold >= cost && count < N(configuration["rescue"], "maxPerAttempt"), "invalid_economy_ledger"); gold -= cost; }
                    usage[key] = count + 1;
                }
                else Need(false, "invalid_economy_ledger");
                Need(Int(gold) && Int(stars) && Items.All(name => Int(Get(inventory, name))), "invalid_economy_ledger");
            }
            Need(Array(Get(migration, "verifiedLevelIds")).All(id => Includes(claimed, id)) && Items.All(item => !Includes(claimed, Get(Item(item), "unlockAfterLevelId")) || gifts.Contains(item)) && Is(Sorted(cleared), Get(state, "clearedLevelIds")) && Is(Sorted(claimed), Get(state, "claimedLevelIds")) && Is(gold, Get(state, "gold")) && Is(stars, Get(state, "stars")) && stars == claimed.Count && Items.All(item => Is(Get(inventory, item), Get(Get(state, "inventory"), item))), "economy_ledger_mismatch"); return true;
        }
        public Dictionary<string, object> Restore(object state) { Validate(state); return W.Copy(state); }
        private static Dictionary<string, object> Result(Dictionary<string, object> state, bool applied, string reason, object reward = null)
        {
            var pending = Array(Get(state["migration"], "recognizedLevelIds")).Where(id => !Includes(Array(state["claimedLevelIds"]), id)).ToList();
            return W.Obj("state", state, "applied", applied, "reason", reason, "reward", reward, "pendingLevelIds", pending);
        }
        private static void Append(Dictionary<string, object> state, string id, Dictionary<string, object> row)
        {
            var ledger = Map(state["transactions"]); Need(!ledger.ContainsKey(id), "duplicate_economy_transaction"); row["sequence"] = ledger.Count + 1; ledger.Add(id, row);
        }
        private static Dictionary<string, object> Row(string kind, object level, object attempt, object item, string source, bool assisted, long cost = 0, object priceVersion = null)
        {
            return W.Obj("kind", kind, "levelId", level, "attemptId", attempt, "itemId", item, "source", source, "assisted", assisted, "sequence", 0, "costGold", cost, "pricesVersion", priceVersion);
        }
        private Dictionary<string, object> Grant(Dictionary<string, object> state, object level, string attempt, string source, bool assisted)
        {
            var reward = W.Obj("gold", N(configuration["reward"], "gold"), "stars", N(configuration["reward"], "stars"), "inventory", EmptyInventory());
            Append(state, ClearId(level), Row("clear", level, attempt, null, source, assisted)); Add(state, "gold", N(reward, "gold")); Add(state, "stars", N(reward, "stars"));
            var cleared = Array(state["clearedLevelIds"]); if (!Includes(cleared, level)) { cleared.Add(level); state["clearedLevelIds"] = Sorted(cleared); }
            var claimed = Array(state["claimedLevelIds"]); claimed.Add(level); state["claimedLevelIds"] = Sorted(claimed);
            foreach (string item in Items) if (Is(Get(Item(item), "unlockAfterLevelId"), level)) { Append(state, GiftId(level, item), Row("gift", level, attempt, item, "milestone", assisted)); Add(Map(reward["inventory"]), item, N(Item(item), "gift")); Add(Map(state["inventory"]), item, N(Item(item), "gift")); }
            return reward;
        }
        public Dictionary<string, object> Migrate(object existing, Dictionary<string, object> legacy = null)
        {
            legacy = legacy ?? W.Obj(); Need(legacy.Keys.All(key => new[] { "done", "verifiedLevelIds", "sourceKey" }.Contains(key)), "invalid_legacy_progress");
            object proofValue = W.Get(legacy, "verifiedLevelIds", W.Arr()); Need(W.IsList(proofValue) && Array(proofValue).All(Known), "invalid_legacy_evidence"); var proofs = Array(proofValue);
            Dictionary<string, object> state; bool applied = false; string reason = "already_migrated"; var reward = W.Obj("gold", 0, "stars", 0, "inventory", EmptyInventory());
            if (existing != null) state = Restore(existing);
            else
            {
                object doneValue = W.Get(legacy, "done", W.Arr()), source = W.Get(legacy, "sourceKey", "hexrota-match-v5");
                Need(LegacyKeys.Any(key => Is(source, key)) && W.IsList(doneValue) && Array(doneValue).All(index => Int(index) && Number(index) < N(configuration, "tutorialCount") + levels.Count), "invalid_legacy_progress");
                var recognized = Sorted(Array(doneValue).Where(index => Number(index) >= N(configuration, "tutorialCount")).Select(index => levels[(int)(Number(index) - N(configuration, "tutorialCount"))]).Concat(proofs).ToList());
                state = CreateState(); state["migration"] = W.Obj("schemaVersion", 1, "source", source, "recognizedLevelIds", recognized, "verifiedLevelIds", W.Arr()); state["clearedLevelIds"] = W.Clone(recognized); applied = true; reason = "migrated";
            }
            foreach (object id in Sorted(proofs)) if (Includes(Array(Get(state["migration"], "recognizedLevelIds")), id) && !Includes(Array(state["claimedLevelIds"]), id))
            {
                var verified = Array(Get(state["migration"], "verifiedLevelIds")); verified.Add(id); Map(state["migration"])["verifiedLevelIds"] = Sorted(verified);
                var itemReward = Grant(state, id, "legacy-" + W.JsString(id), "legacy", false); Add(reward, "gold", N(itemReward, "gold")); Add(reward, "stars", N(itemReward, "stars")); foreach (string name in Items) Add(Map(reward["inventory"]), name, N(itemReward["inventory"], name)); applied = true; if (reason != "migrated") reason = "legacy_review_applied";
            }
            Validate(state); return Result(state, applied, reason, N(reward, "gold") != 0 || N(reward, "stars") != 0 ? reward : null);
        }
        public Dictionary<string, object> Complete(object raw, Dictionary<string, object> context)
        {
            var state = Restore(raw);
            Need(context != null && context.Keys.All(key => new[] { "levelId", "attemptId", "status", "verified", "assisted", "tutorial" }.Contains(key)) && Token(Get(context, "attemptId")) && new[] { "won", "lost", "playing" }.Any(status => Is(Get(context, "status"), status)) && Get(context, "verified") is bool && (!W.Has(context, "assisted") || Get(context, "assisted") is bool) && (!W.Has(context, "tutorial") || Get(context, "tutorial") is bool), "invalid_economy_context");
            object level = Get(context, "levelId"); if (Includes(tutorials, level)) return Result(state, false, "tutorial_no_reward"); Need(Known(level) && !Is(Get(context, "tutorial"), true), "invalid_economy_level");
            if (Includes(Array(state["clearedLevelIds"]), level)) return Result(state, false, "already_cleared"); if (!Is(level, Next(Array(state["clearedLevelIds"])))) return Result(state, false, "level_locked"); if (!Is(Get(context, "status"), "won")) return Result(state, false, "not_won"); if (!Is(Get(context, "verified"), true)) return Result(state, false, "unverified_win");
            var reward = Grant(state, level, (string)context["attemptId"], "gameplay", Is(Get(context, "assisted"), true)); Validate(state); return Result(state, true, "level_claimed", reward);
        }
        // Both onboarding presentations share one ledger entry and require a verified win.
        public Dictionary<string, object> ClaimWelcome(object raw, Dictionary<string, object> context, bool taughtInFirstChapter = false)
        {
            var state = Restore(raw);
            Need(Exact(context, "levelId", "attemptId", "status", "verified") && Token(Get(context, "attemptId")) && new[] { "won", "lost", "playing" }.Any(status => Is(Get(context, "status"), status)) && Get(context, "verified") is bool, "invalid_welcome_context");
            if (!Is(Get(context, "levelId"), taughtInFirstChapter ? levels[0] : tutorials[1])) return Result(state, false, "welcome_unavailable");
            object prior = Get(state["transactions"], WelcomeId());
            if (prior != null) return Result(state, false, Is(Get(prior, "kind"), "welcome") ? "welcome_already_claimed" : "transaction_conflict");
            if (!Is(Get(context, "status"), "won")) return Result(state, false, "not_won");
            if (!Is(Get(context, "verified"), true)) return Result(state, false, "unverified_win");
            var reward = W.Obj("gold", WelcomeGold, "stars", 0, "inventory", EmptyInventory());
            Append(state, WelcomeId(), Row("welcome", null, context["attemptId"], null, "onboarding", false, 0, WelcomeVersion));
            Add(state, "gold", WelcomeGold); Validate(state); return Result(state, true, "welcome_claimed", reward);
        }
        public bool CanEnter(object raw, object level) { var state = Restore(raw); return Includes(tutorials, level) || Known(level) && Is(Next(Array(state["clearedLevelIds"])), level); }
        public object NextLevel(object raw) { return Next(Array(Restore(raw)["clearedLevelIds"])); }
        public Dictionary<string, object> View(object raw)
        {
            var state = Restore(raw); object next = Next(Array(state["clearedLevelIds"]));
            var unlocks = W.Obj(); foreach (string item in Items) unlocks.Add(item, Includes(Array(state["clearedLevelIds"]), Get(Item(item), "unlockAfterLevelId")));
            var botanical = W.Arr(); foreach (object entry in Array(configuration["botanical"])) { var copy = W.Copy(entry); copy.Add("unlocked", N(state, "stars") >= N(entry, "stars")); botanical.Add(copy); }
            return W.Obj("gold", state["gold"], "stars", state["stars"], "inventory", W.Clone(state["inventory"]), "cleared", W.Clone(state["clearedLevelIds"]), "claimed", W.Clone(state["claimedLevelIds"]), "clearedLevelIds", W.Clone(state["clearedLevelIds"]), "claimedLevelIds", W.Clone(state["claimedLevelIds"]), "nextLevelId", next, "campaignComplete", next == null, "pendingReviewLevelIds", Array(Get(state["migration"], "recognizedLevelIds")).Where(id => !Includes(Array(state["claimedLevelIds"]), id)).ToList(), "unlocks", unlocks, "botanical", botanical);
        }
        private Dictionary<string, object> Operation(object raw, Dictionary<string, object> context, string kind)
        {
            var state = Restore(raw); string[] allowed = kind == "purchase" ? new[] { "operationId", "itemId" } : kind == "use" ? new[] { "operationId", "itemId", "attemptId", "levelId" } : new[] { "operationId", "attemptId", "levelId" };
            Need(Exact(context, allowed) && Token(Get(context, "operationId")) && !((string)Get(context, "operationId")).StartsWith("clear:", StringComparison.Ordinal) && !((string)Get(context, "operationId")).StartsWith("gift:", StringComparison.Ordinal) && !((string)Get(context, "operationId")).StartsWith("welcome:", StringComparison.Ordinal), "invalid_economy_operation"); if (kind != "rescue") Need(Items.Any(item => Is(Get(context, "itemId"), item)), "invalid_economy_item"); if (kind != "purchase") Need(Known(Get(context, "levelId")) && Token(Get(context, "attemptId")), "invalid_economy_context");
            string itemId = kind == "rescue" ? "rescue5" : (string)context["itemId"], operationId = (string)context["operationId"]; object level = kind == "purchase" ? null : context["levelId"], attempt = kind == "purchase" ? null : context["attemptId"];
            object prior = Get(state["transactions"], operationId); if (prior != null) return Result(state, false, Is(Get(prior, "kind"), kind) && Is(Get(prior, "itemId"), itemId) && Is(Get(prior, "levelId"), level) && Is(Get(prior, "attemptId"), attempt) ? "duplicate_transaction" : "transaction_conflict");
            if (kind != "purchase" && !Is(Next(Array(state["clearedLevelIds"])), level)) return Result(state, false, Includes(Array(state["clearedLevelIds"]), level) ? "already_cleared" : "level_locked");
            if (kind != "rescue" && !Includes(Array(state["clearedLevelIds"]), Get(Item(itemId), "unlockAfterLevelId"))) return Result(state, false, "item_locked");
            int used = Map(state["transactions"]).Values.Count(entry => Is(Get(entry, "kind"), kind) && Is(Get(entry, "attemptId"), attempt) && Is(Get(entry, "itemId"), itemId));
            if (kind == "use" && (Number(level) <= N(Item(itemId), "unlockAfterLevelId") || used >= N(Item(itemId), "maxPerAttempt"))) return Result(state, false, Number(level) <= N(Item(itemId), "unlockAfterLevelId") ? "item_locked" : "attempt_limit");
            if (kind == "rescue" && used >= N(configuration["rescue"], "maxPerAttempt")) return Result(state, false, "attempt_limit");
            long cost = kind == "purchase" ? N(Item(itemId), "costGold") : kind == "rescue" ? N(configuration["rescue"], "goldCost") : 0;
            if (N(state, "gold") < cost) return Result(state, false, "insufficient_gold"); if (kind == "use" && N(state["inventory"], itemId) == 0) return Result(state, false, "insufficient_stock");
            Append(state, operationId, Row(kind, level, attempt, itemId, "command", kind != "purchase", cost, cost != 0 ? configuration["pricesVersion"] : null)); Add(state, "gold", -cost); if (kind == "purchase") Add(Map(state["inventory"]), itemId, 1); if (kind == "use") Add(Map(state["inventory"]), itemId, -1); Validate(state);
            var result = Result(state, true, kind == "purchase" ? "item_purchased" : kind == "use" ? "item_consumed" : "rescue_paid"); result.Add("costGold", cost); result.Add("itemId", itemId); return result;
        }
        public Dictionary<string, object> Purchase(object state, Dictionary<string, object> context) { return Operation(state, context, "purchase"); }
        public Dictionary<string, object> Consume(object state, Dictionary<string, object> context) { return Operation(state, context, "use"); }
        public Dictionary<string, object> SpendRescue(object state, Dictionary<string, object> context) { return Operation(state, context, "rescue"); }
        public object GetTransaction(object state, object id) { Need(Token(id), "invalid_economy_operation"); return W.Clone(Get(Restore(state)["transactions"], (string)id)); }
    }
}
