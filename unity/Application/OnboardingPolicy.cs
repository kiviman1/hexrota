using System;
using System.Collections.Generic;
using Hexrota.Contracts;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    // Presentation policy only. This helper has no gameplay, persistence, clock,
    // economy or RNG dependency. Missing legacy policy is represented by null;
    // explicit persisted null is invalid and must pass through Validate instead.
    public static class OnboardingPolicy
    {
        private static bool Exact(object value, params string[] keys)
        {
            if (!W.IsMap(value) || W.Map(value).Count != keys.Length) return false;
            foreach (string key in keys) if (!W.Has(value, key)) return false;
            return true;
        }
        public static Dictionary<string, object> Validate(object value)
        {
            if (!Exact(value, "version") ||
                !W.Equal(W.Get(value, "version"), "onboarding-v1") && !W.Equal(W.Get(value, "version"), "onboarding-v2"))
                W.Fail("invalid_onboarding_policy", "invalid_onboarding_policy");
            return W.Obj("version", W.Get(value, "version"));
        }
        // JSON hosts pass present=false for a missing property. It is distinct
        // from an explicit null, which is always rejected by Validate.
        public static Dictionary<string, object> Normalize(object value, object options, bool present = true)
        {
            if (!Exact(options, "existingRecord", "eligible") || !(W.Get(options, "existingRecord") is bool) || !(W.Get(options, "eligible") is bool))
                W.Fail("invalid_onboarding_context", "invalid_onboarding_context");
            if (present) return Validate(value);
            return !W.Equal(W.Get(options, "existingRecord"), true) && W.Equal(W.Get(options, "eligible"), true) ? W.Obj("version", "onboarding-v2") : null;
        }
        public static bool IsV2(object policy)
        {
            return policy != null && W.Equal(Validate(policy)["version"], "onboarding-v2");
        }
        public static Dictionary<string, object> Rules(object policy)
        {
            bool v2 = IsV2(policy);
            return W.Obj("version", v2 ? "onboarding-v2" : "onboarding-v1", "automaticFeedback", v2, "feedbackMs", 900, "idleMs", 4000);
        }
        public static bool RequiresAcknowledgement(object policy, object step)
        {
            return !IsV2(policy) && W.Equal(W.Get(step, "acknowledge"), true);
        }
        private static Dictionary<string, object> Projection(string title, string text, string concept, bool autonomy)
        {
            return W.Obj("title", title, "text", text, "concept", concept, "autonomy", autonomy);
        }
        public static Dictionary<string, object> Project(object policy, object facts)
        {
            if (!IsV2(policy)) return null;
            if (!W.IsMap(facts) || !W.Has(facts, "levelId")) W.Fail("invalid_onboarding_projection", "invalid_onboarding_projection");
            object level = W.Get(facts, "levelId");
            if (!W.Equal(level, "learn-1") && !W.Equal(level, "learn-2")) return null;
            object turnValue = W.Get(facts, "turn"), phaseValue = W.Get(facts, "phase");
            if (!Exact(facts, "levelId", "turn", "phase") || !W.IsInteger(turnValue) || W.Number(turnValue) < 0 || W.Number(turnValue) > int.MaxValue ||
                !W.Equal(phaseValue, "ready") && !W.Equal(phaseValue, "result") && !W.Equal(phaseValue, "busy"))
                W.Fail("invalid_onboarding_projection", "invalid_onboarding_projection");
            int turn = W.Int32(turnValue); bool result = !W.Equal(phaseValue, "ready");
            if (W.Equal(level, "learn-1"))
            {
                if (turn == 0) return Projection("2’yi 1’e kaydır.", "Ya da ikisine sırayla dokun.", "swap", false);
                if (turn >= 3) return Projection("İlk alan yeşerdi!", "Her yer yeşil. Yeni zemine hazırsın.", "both", false);
                if (result) return turn == 1 ? Projection("Yeşil zemin kalır.", "Şimdi bir üçlü daha bul.", "ground", false) : Projection("Biraz daha yeşerdi.", "Son iki yeri de yeşert.", "ground", false);
                return turn == 1 ? Projection("Sıra sende: bir üçlü bul.", "Yeşil yerler yeni taşlar gelse de kalır.", "ground", true) : Projection("Son iki yeri yeşert.", "Bir üçlü daha bul.", "ground", true);
            }
            if (turn == 0) return Projection("Noktalı yeri yeşert.", "Noktalı zeminde bir üçlü oluştur.", "ground", W.Equal(phaseValue, "ready"));
            if (turn >= 4) return Projection("Görev tamam!", "Puanın yeterli ve her yer yeşil.", "both", false);
            if (result)
            {
                if (turn == 1) return Projection("Bir eşleşme daha gerekiyor.", "Noktalı yerde bir nokta kaldı.", "ground", false);
                if (turn == 2) return Projection("Yeni taşlar da eşleşti!", "Ek hamle harcamadın. Hedefin 25 puan.", "score", false);
                return Projection("Puan tamam; son yeri yeşert.", "Bir yer kaldı. Onu da yeşile boya.", "both", false);
            }
            return turn < 3 ? Projection("25 puana ulaş.", "Bir üçlü daha bul.", "score", true) : Projection("Puan tamam; son yeri yeşert.", "Son bir üçlü bul.", "both", true);
        }
    }
}
