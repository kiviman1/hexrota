using System.Linq;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class HomeRewardRulesTests
    {
        [TestCase(1, 1)]
        [TestCase(3, 3)]
        [TestCase(5, 5)]
        [TestCase(6, 8)]
        [TestCase(20, 8)]
        [TestCase(1000, 8)]
        public void IconsCarryTheExactEarnedAmount(int amount, int icons)
        {
            int[] shares = RewardFlight.DistributeAmount(amount);
            Assert.That(shares, Has.Length.EqualTo(icons));
            Assert.That(shares.Sum(), Is.EqualTo(amount));
            Assert.That(shares, Is.All.GreaterThanOrEqualTo(0));
            Assert.That(shares.Last(), Is.Positive);
        }

        [Test]
        public void HigherPriorityPreemptsAndThePreviousOwnerResumes()
        {
            var go = new GameObject("Attention Test");
            try
            {
                var attention = go.AddComponent<AttentionDirector>();
                var shine = new object();
                var reward = new object();
                var badge = new object();
                bool shineWasInterrupted = false;
                Assert.That(attention.TryAcquire(AttentionKind.PlayShine, shine), Is.True);
                attention.Changed += () => shineWasInterrupted |= !attention.IsOwner(shine);
                Assert.That(attention.TryAcquire(AttentionKind.RewardFlight, reward), Is.True);
                Assert.That(shineWasInterrupted, Is.True);
                Assert.That(attention.IsOwner(shine), Is.False);
                Assert.That(attention.IsOwner(reward), Is.True);
                Assert.That(attention.TryAcquire(AttentionKind.BadgeWiggle, badge), Is.False);

                attention.SetModalOpen(true);
                attention.Release(reward);
                Assert.That(attention.TryAcquire(AttentionKind.PlayShine, shine), Is.False);
                Assert.That(attention.TryAcquire(AttentionKind.BadgeWiggle, badge), Is.False);
                attention.SetModalOpen(false);
                Assert.That(attention.IsOwner(shine), Is.True);
                Assert.That(attention.TryAcquire(AttentionKind.PlayShine, shine), Is.True);
                attention.Release(shine);
                Assert.That(attention.IsOwner(badge), Is.False, "A rejected request must not start later.");
            }
            finally { Object.DestroyImmediate(go); }
        }

        [Test]
        public void PrefabReferencesTheDefaultHomeThemes()
        {
            const string path = "Assets/Hexrota/Presentation/Theme/";
            var ui = AssetDatabase.LoadAssetAtPath<UiTheme>(path + "UiTheme.asset");
            var motion = AssetDatabase.LoadAssetAtPath<MotionTheme>(path + "MotionTheme.asset");
            Assert.That(ui, Is.Not.Null);
            Assert.That(motion, Is.Not.Null);
            Assert.That(new Color32[] { ui.cta, ui.ctaDeep, ui.ctaLight, ui.gold, ui.goldDeep, ui.goldLight, ui.panelDeep },
                Is.EqualTo(new[] { Hex("#5CC531"), Hex("#2E7A12"), Hex("#A6EF6A"), Hex("#FFC531"),
                    Hex("#A86A00"), Hex("#FFE89A"), Hex("#3A1A58") }));
            Assert.That(ui.ctaBandOpacity, Is.EqualTo(.55f));
            Assert.That(new[] {motion.tap.seconds, motion.release.seconds, motion.popIn.seconds, motion.popOut.seconds,
                motion.flyMin, motion.flyMax, motion.flyStagger, motion.punch.seconds, motion.punchScale,
                motion.breathePeriod, motion.breatheAmplitude, motion.shineInterval, motion.shineDuration,
                motion.idleHopDelay, motion.rewardStartDelay, motion.reducedFlyDuration, motion.flyLaunchDuration},
                Is.EqualTo(new[] {.08f,.18f,.30f,.15f,.55f,.75f,.06f,.20f,1.15f,2.4f,.03f,4f,.6f,8f,.3f,.3f,.1f}));
            Assert.That(motion.arrivalHapticMs, Is.InRange(1, 20));
            Assert.That(motion.pressDepth, Is.EqualTo(4f));
            Assert.That(new[] { ui.bevelAtRest, ui.bevelPressed, ui.rewardIconSize }, Is.EqualTo(new[] { 8f, 2f, 28f }));
            Assert.That(ui.bevelAtRest - motion.pressDepth, Is.GreaterThanOrEqualTo(ui.bevelPressed),
                "A pressed button must keep at least the pressed bevel.");
            Assert.That(new Color32[] { ui.sky, ui.skyDeep, ui.heart, ui.heartDeep },
                Is.EqualTo(new[] { Hex("#3BA9F5"), Hex("#165FA0"), Hex("#F0414F"), Hex("#9E1426") }));
            Assert.That(new[] { motion.fill.seconds, motion.coopPulsePeriod, motion.coopPulseScale }, Is.EqualTo(new[] { .4f, .9f, 1.08f }));
            Assert.That(motion.fill.curve.Evaluate(.5f), Is.GreaterThan(.5f), "fill is ease-out");
            Assert.That(ui.coopScaleEmpty, Is.InRange(.5f, 1f));
            Assert.That(new Color32[] { ui.panel, ui.panelInset, ui.cream, ui.ink, ui.onPanelMuted, ui.disabled, ui.disabledDeep },
                Is.EqualTo(new[] { Hex("#5B2C83"), Hex("#46206A"), Hex("#FFF6E5"), Hex("#2A1440"), Hex("#D9C6EC"), Hex("#B8AEC4"), Hex("#7D7189") }));
            Assert.That(ui.shadeOpacity, Is.EqualTo(.5f));
            Assert.That(new[] { motion.shadeIn, motion.shadeOut, motion.panelOpenScale, motion.panelCloseScale, motion.shake.seconds },
                Is.EqualTo(new[] { .2f, .15f, .85f, .9f, .3f }));
            Assert.That(motion.shakeDistance, Is.Positive);
            Assert.That(new[] { motion.coopSquash.seconds, motion.reducedUpgradePunch.seconds, motion.coopSquashAmount,
                motion.levelBannerHold, motion.residentStagger }, Is.EqualTo(new[] { .4f, .15f, .12f, .9f, .08f }));
            Assert.That(motion.reducedFlyDuration + motion.reducedUpgradePunch.seconds, Is.LessThanOrEqualTo(.5f),
                "Reduced-motion upgrade stays within 0.5 s.");
            Assert.That(motion.tap.curve.Evaluate(.5f), Is.GreaterThan(.5f));
            Assert.That(motion.release.curve.Evaluate(.6f), Is.EqualTo(1.0896f).Within(.001f));
            Assert.That(motion.popIn.curve.Evaluate(.6f), Is.EqualTo(1.0992f).Within(.001f));
            Assert.That(motion.popOut.curve.Evaluate(.5f), Is.LessThan(.5f));
            Assert.That(motion.punch.curve.Evaluate(.15f), Is.GreaterThan(1));
            Assert.That(motion.breathe.Evaluate(.5f), Is.EqualTo(1));
            foreach (var curve in new[] { motion.fly, motion.shine })
            {
                Assert.That(curve.Evaluate(.25f), Is.LessThan(.25f));
                Assert.That(curve.Evaluate(.75f), Is.GreaterThan(.75f));
            }

            var prefab = Resources.Load<GameObject>("CastleHome/CastleHome");
            Assert.That(prefab.GetComponentsInChildren<AttentionDirector>(), Has.Length.EqualTo(1));
            foreach (var component in new MonoBehaviour[] { prefab.GetComponent<RewardFlight>(),
                prefab.GetComponentInChildren<HomePlayButton>(), prefab.GetComponent<CoopHomeView>(),
                prefab.GetComponentInChildren<CoopUpgradePanel>(true), prefab.GetComponent<CoopUpgradeSequence>() })
            {
                var serialized = new SerializedObject(component);
                Assert.That(serialized.FindProperty("ui").objectReferenceValue, Is.SameAs(ui));
                Assert.That(serialized.FindProperty("motion").objectReferenceValue, Is.SameAs(motion));
            }
        }

        private static Color32 Hex(string text)
        {
            Assert.That(ColorUtility.TryParseHtmlString(text, out var color), Is.True);
            return color;
        }
    }
}
