using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    internal sealed class PhoneRewardHaptics : IDisposable
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        private AndroidJavaObject vibrator;
        private IntPtr method;
        private readonly jvalue[] arguments = new jvalue[1];
#elif UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void HexrotaPrepareRewardHaptic(int milliseconds);
        [DllImport("__Internal")] private static extern void HexrotaPlayRewardHaptic();
#elif UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void HexrotaPlayRewardHaptic(int milliseconds);
        private int duration;
#endif

        internal void Prepare(int milliseconds)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            if (!SystemInfo.supportsVibration) return;
            arguments[0].j = milliseconds;
            if (vibrator != null) return;
            try
            {
                using (var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                using (var activity = player.GetStatic<AndroidJavaObject>("currentActivity"))
                    vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator");
                if (vibrator != null && vibrator.Call<bool>("hasVibrator"))
                    method = AndroidJNI.GetMethodID(vibrator.GetRawClass(), "vibrate", "(J)V");
            }
            catch (AndroidJavaException) { Dispose(); }
#elif UNITY_IOS && !UNITY_EDITOR
            HexrotaPrepareRewardHaptic(milliseconds);
#elif UNITY_WEBGL && !UNITY_EDITOR
            duration = milliseconds;
#endif
        }

        internal void Play()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            if (method == IntPtr.Zero || vibrator == null) return;
            AndroidJNI.CallVoidMethod(vibrator.GetRawObject(), method, arguments);
            // Some devices disallow vibration while a background transition is in progress.
            AndroidJNI.ExceptionClear();
#elif UNITY_IOS && !UNITY_EDITOR
            HexrotaPlayRewardHaptic();
#elif UNITY_WEBGL && !UNITY_EDITOR
            HexrotaPlayRewardHaptic(duration);
#endif
        }

        public void Dispose()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            method = IntPtr.Zero;
            vibrator?.Dispose();
            vibrator = null;
#endif
        }
    }
}
