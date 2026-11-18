using System;
using System.Collections.Generic;
using Hexrota.Lives;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    public sealed partial class GameSessionController
    {
        public Dictionary<string, object> PlayerPreferences()
        {
            var result = W.Copy(game["preferences"]);
            result["sound"] = game["sound"];
            return result;
        }

        public Dictionary<string, object> SetPlayerPreferences(bool? sound = null, bool? music = null,
            double? volume = null, string motion = null, bool? haptics = null, SessionCommand command = null)
        {
            if (motion != null && motion != "auto" && motion != "reduce" && motion != "full")
                return Result(false, "invalid_preference");
            if (volume.HasValue && (double.IsNaN(volume.Value) || volume < 0 || volume > 1))
                return Result(false, "invalid_preference");
            return Execute(() => {
                var preferences = W.Map(game["preferences"]);
                if (sound.HasValue) game["sound"] = sound.Value;
                if (music.HasValue) preferences["music"] = music.Value;
                if (volume.HasValue) preferences["volume"] = volume.Value;
                if (motion != null) preferences["motion"] = motion;
                if (haptics.HasValue) preferences["haptics"] = haptics.Value;
                return Result(true, "preferences_saved");
            }, command);
        }

        public Dictionary<string, object> LifeProductOffer(string product)
        {
            var offer = lives.TransactionAvailability(new LifeState(W.Map(energy["life"])), product);
            if (W.Integer(offer["costGold"]) > W.Integer(W.Get(energy["testWallet"], "gold")))
            {
                offer["allowed"] = false;
                offer["reason"] = "insufficient_gold";
            }
            if (product == "ad_life" && !W.Equal(W.Get(energy["provider"], "adAvailable"), true))
            {
                offer["allowed"] = false;
                offer["reason"] = "unavailable";
            }
            return offer;
        }

        public int PreviewRestartCharge()
        {
            if (engine == null || engine.Status != "playing") return 0;
            var current = new LifeState(W.Map(energy["life"]));
            var preview = lives.SettleAttempt(current, LifeContext(CurrentEntry(), "restart"));
            return preview.Charged == true ? 1 : 0;
        }

        public Dictionary<string, object> PlaytestContext()
        {
            return engine == null ? null : Context(CurrentEntry());
        }

        public int PreviewResetCharge()
        {
            int count = 0;
            var life = new LifeState(W.Map(energy["life"]));
            for (int index = 0; index < levels.Count; index++)
            {
                if (Completed(index)) continue;
                var entry = RestoreEntry(index, false);
                if (entry == null || entry.engine.Status != "playing") continue;
                var settlement = lives.SettleAttempt(life, LifeContext(entry, "restart"));
                life = settlement.State;
                if (settlement.Charged == true) count++;
            }
            return count;
        }

        public Dictionary<string, object> ResetForDevelopmentTest(bool confirmed, SessionCommand command = null)
        {
            if (!confirmed) return Result(false, "cancelled");
            // Use the same initialization path as a first launch. Isolate receipts
            // from the old installation and commit the replacement using its revision.
            var fresh = new GameSessionController(catalog, levels, tutorialCount,
                new ProfileRepository(new MemoryProfileStorage()), lives.Config.ToWire(), clock,
                initialSelectionSeed, "hexrota-test-" + Guid.NewGuid().ToString("N"), rewardRules,
                economyConfig: economy.Config(), rescueProviderNamespace: "hexrota-rescue-" + Guid.NewGuid().ToString("N"));
            var result = Execute(() => {
                game = fresh.GameSave;
                energy = fresh.EnergySave;
                events = fresh.EventSave;
                LoadExisting(0, false);
                return Result(true, "test_profile_reset");
            }, command);
            if (W.Equal(result["ok"], true)) pendingRescueDelivery = null;
            return result;
        }
    }
}
