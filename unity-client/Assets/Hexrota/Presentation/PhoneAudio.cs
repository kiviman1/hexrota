using System;
using System.Collections.Generic;
using Hexrota.Rewards;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // The note sequence and envelopes come from dist/audio.js. Sources and clips
    // are owned by the scene, and no audio is started before a player gesture.
    public sealed class PhoneAudio : MonoBehaviour
    {
        private const int Hz = 22050;
        private AudioSource sfx, music;
        private AudioClip motif;
        private bool unlocked, homePlaybackReady;
        private readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();

        private void Awake()
        {
            if (FindAnyObjectByType<AudioListener>() == null) gameObject.AddComponent<AudioListener>();
            sfx = gameObject.AddComponent<AudioSource>();
            music = gameObject.AddComponent<AudioSource>();
            sfx.playOnAwake = music.playOnAwake = false;
            music.loop = true;
        }
        public void Configure(UnityGameSession session, bool active, bool gesture = false)
        {
            unlocked |= gesture;
            if (session == null || !unlocked || sfx == null || music == null) return;
            sfx.volume = music.volume = session.Volume;
            if (!active || !session.SoundEnabled) sfx.Stop();
            if (active && session.MusicEnabled)
            {
                if (motif == null) motif = BuildMotif();
                if (music.clip != motif) music.clip = motif;
                if (!music.isPlaying) music.Play();
            }
            else music.Stop();
        }
        public void Click(UnityGameSession session)
        {
            if (session == null) return;
            unlocked = true;
            if (!session.SoundEnabled) return;
            if (!clips.TryGetValue("click", out var click))
            {
                var data = new float[(int)(Hz * .08)];
                Note(data, 420, 0, .075, .045);
                clips["click"] = click = Clip("Tap", data);
            }
            sfx.volume = session.Volume;
            sfx.PlayOneShot(click);
        }
        public void Reward(UnityGameSession session, RewardCue cue)
        {
            if (session == null || cue == null) return;
            unlocked = true;
            if (session.HapticsEnabled && cue.hapticMs > 0 && SystemInfo.supportsVibration)
                Vibrate(Math.Min(60,cue.hapticMs));
            if (!session.SoundEnabled) return;
            Reward(GetRewardClip(cue), session.Volume);
        }

        internal AudioClip PrepareHomeReward(RewardCue cue, float volume)
        {
            var clip = GetRewardClip(cue);
            if (!homePlaybackReady)
            {
                // Warm Unity's one-shot audio path before any animated arrivals.
                Reward(clip, volume, voiceScale: 0);
                homePlaybackReady = true;
            }
            return clip;
        }

        private AudioClip GetRewardClip(RewardCue cue)
        {
            string key = cue.tier + "/" + cue.pitchStep + "/" + cue.reason;
            if (!clips.TryGetValue(key, out var clip))
            {
                int tier = Mathf.Clamp(cue.tier,0,3);
                bool won = cue.completion || cue.reason == "win" || cue.reason == "last_move_win";
                int[][] harmony = {new[]{0}, new[]{0,5}, new[]{0,4,9}, new[]{0,4,7,12}};
                int[] notes = tier == 3 && won ? (cue.reason == "last_move_win" ? new[]{0,5,9,12} : new[]{0,7,9,12}) : harmony[tier];
                var data = new float[Hz / 2];
                for (int i=0;i<notes.Length;i++) Note(data,392*Math.Pow(2,(Mathf.Clamp(cue.pitchStep,-12,12)+notes[i])/12d),
                    i * .055, .22 + tier * .015 + (won ? .035 : 0), .065 / notes.Length, triangle:i > 0);
                clips[key] = clip = Clip("Reward",data);
            }
            return clip;
        }

        internal void Reward(AudioClip clip, float volume, float voiceScale = 1)
        {
            if (clip == null) return;
            unlocked = true;
            sfx.volume = volume;
            sfx.PlayOneShot(clip, voiceScale);
        }
        private static void Vibrate(int ms)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using (var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                using (var activity = player.GetStatic<AndroidJavaObject>("currentActivity"))
                using (var vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator"))
                    if (vibrator != null && vibrator.Call<bool>("hasVibrator")) vibrator.Call("vibrate", (long)ms);
            }
            catch (AndroidJavaException) { /* Haptic hardware is optional. */ }
#elif UNITY_IOS && !UNITY_EDITOR
            Handheld.Vibrate();
#endif
        }
        private static AudioClip BuildMotif()
        {
            double[] roots = {220,261.63,246.94,293.66,196,246.94,261.63,220};
            var samples = new float[(int)(Hz * 1.6 * roots.Length)];
            for (int i=0;i<roots.Length;i++)
            {
                Note(samples,roots[i],i*1.6,2.1,.06*.55,.12);
                Note(samples,roots[i]*1.5,i*1.6+.18,1.8,.033*.55,.12);
            }
            return Clip("Garden motif",samples);
        }
        private static void Note(float[] samples, double freq, double delay, double duration, double gain, double attack=.012, bool triangle=false)
        {
            int start=(int)(delay*Hz), len=(int)(duration*Hz);
            for (int i=0;i<len;i++)
            {
                double t=(double)i/Hz;
                double wave=Math.Sin(2*Math.PI*freq*t);
                if (triangle) wave=2/Math.PI*Math.Asin(wave);
                double envelope=t<attack ? gain*t/attack : gain*Math.Pow(.0001/gain,(t-attack)/(duration-attack));
                samples[(start+i)%samples.Length] += (float)(wave*envelope);
            }
        }
        private static AudioClip Clip(string label,float[] samples)
        {
            var clip = AudioClip.Create(label,samples.Length,1,Hz,false);
            clip.SetData(samples,0);
            return clip;
        }
        private void OnDisable() { if (music != null) music.Stop(); if (sfx != null) sfx.Stop(); }
        private void OnDestroy()
        {
            if (motif != null) Destroy(motif);
            foreach(var clip in clips.Values) if (clip != null) Destroy(clip);
        }
    }
}
