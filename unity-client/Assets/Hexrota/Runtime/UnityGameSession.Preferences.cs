using System;
using System.Collections.Generic;
using Hexrota.Rewards;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public sealed partial class UnityGameSession
    {
        public bool SoundEnabled { get { return (bool)controller.PlayerPreferences()["sound"]; } }
        public bool MusicEnabled { get { return (bool)controller.PlayerPreferences()["music"]; } }
        public bool HapticsEnabled { get { return (bool)controller.PlayerPreferences()["haptics"]; } }
        public float Volume { get { return (float)W.Number(controller.PlayerPreferences()["volume"]); } }
        public string MotionPreference { get { return (string)controller.PlayerPreferences()["motion"]; } }
        public bool ReducedMotion { get { return MotionPreference == "reduce" || (MotionPreference == "auto" && DeviceMotion.Reduced); } }
        public RewardPlan FeedbackPlan { get { return controller.LastRewardPlan; } }

        public bool SetPreferences(bool? sound = null, bool? music = null, float? volume = null,
            string motion = null, bool? haptics = null)
        {
            return Apply(() => controller.SetPlayerPreferences(sound, music, volume, motion, haptics, Command()));
        }

        public Dictionary<string, object> LifeStatus { get { return W.Map(controller.View()["life"]); } }
        public int TestGold { get { return W.Int32(W.Required(W.Required(controller.EnergySave, "testWallet"), "gold")); } }
        public bool LifeTestAds { get { return (bool)W.Required(W.Required(controller.EnergySave,"provider"),"adAvailable"); } }
        public bool RescueTestAds { get { return (bool)W.Required(W.Required(W.Required(controller.GameSave,"rescue"),"provider"),"adAvailable"); } }
        public bool SetLifeBypass(bool on) { return Apply(() => controller.SetDeveloperBypass(on, Command())); }
        public bool SetLifeTestAds(bool on) { return Apply(() => controller.SetAdAvailable(on)); }
        public bool SetRescueTestAds(bool on) { return Apply(() => controller.SetRescueAdAvailable(on, Command())); }
        public int ResetCharge { get { return controller.PreviewResetCharge(); } }
        public bool ResetOpenAttempts(int maximumCharge) { return Apply(() => controller.ResetProgress(true, maximumCharge, Command())); }
        public bool ResetForDevelopmentTest()
        {
            if (!Apply(() => controller.ResetForDevelopmentTest(true, Command()))) return false;
            ClearPlaytestData(true);
            CancelPresentation();
            inGame = false;
            return true;
        }
        public Dictionary<string, object> LifeProduct(string product) { return controller.LifeProductOffer(product); }
        public string BeginLifeProduct(string product)
        {
            string id = null;
            Apply(() => { var result = controller.BeginProduct(product); id = W.Get(result, "transactionId") as string; return result; });
            return id;
        }
        public bool FinishLifeProduct(string id, bool confirmed)
        {
            return Apply(() => controller.CompleteProduct(id, confirmed ? "completed" : "cancelled"));
        }
    }

    internal static class DeviceMotion
    {
#if UNITY_IOS && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("__Internal")]
        [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.I1)]
        private static extern bool UIAccessibilityIsReduceMotionEnabled();
#endif
        internal static bool Reduced
        {
            get
            {
#if UNITY_IOS && !UNITY_EDITOR
                return UIAccessibilityIsReduceMotionEnabled();
#elif UNITY_ANDROID && !UNITY_EDITOR
                try
                {
                    using (var player = new UnityEngine.AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                    using (var activity = player.GetStatic<UnityEngine.AndroidJavaObject>("currentActivity"))
                    using (var resolver = activity.Call<UnityEngine.AndroidJavaObject>("getContentResolver"))
                    using (var settings = new UnityEngine.AndroidJavaClass("android.provider.Settings$Global"))
                        return settings.CallStatic<float>("getFloat", resolver, "animator_duration_scale", 1f) == 0;
                }
                catch (UnityEngine.AndroidJavaException) { return false; }
#else
                return false;
#endif
            }
        }
    }
}
