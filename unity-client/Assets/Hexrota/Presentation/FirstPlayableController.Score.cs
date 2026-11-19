using System.Linq;
using Hexrota.Gameplay;
using Hexrota.Rewards;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        [SerializeField] private ScorePacketView scorePacketPrefab;
        private RectTransform feedbackLayer, packet;
        private ScorePacketView scorePacket;
        private Vector3 packetRestScale;
        private MovePresentation scoreMove;
        private RewardPlan scorePlan;
        private int waveNumber, priorWaveScore;
        private bool scoreMilestone, groundMilestone, groundShown, landed;

        private void CreateScoreFeedback()
        {
            feedbackLayer = Rect("ScoreFeedback", gameplay.transform, Vector2.zero, Vector2.one);
            var prefab = scorePacketPrefab != null ? scorePacketPrefab :
                Resources.Load<GameObject>("CastleGame/ScorePacket").GetComponent<ScorePacketView>();
            scorePacket = Instantiate(prefab, feedbackLayer, false);
            scorePacket.name = "ScorePacket";
            packet = (RectTransform)scorePacket.transform;
            packetRestScale = packet.localScale;
            packet.gameObject.SetActive(false);
            feedbackLayer.gameObject.SetActive(false);
        }

        private void BeginScoreFeedback(MovePresentation move)
        {
            ClearScoreFeedback();
            if (!move.Ok) return;
            castleHud.ShowMoves(move.After.movesLeft);
            if (move.Swap == null || move.Swap.frames.Length == 0) return;
            scoreMove = move;
            scorePlan = move.A >= 0 && move.B >= 0 ? Session.FeedbackPlan : null;
            priorWaveScore = move.Before.score;
            if (!Board.ReducedMotion) feedbackLayer.gameObject.SetActive(true);
        }

        private static string CueText(RewardCue cue)
        {
            switch (cue.labelKey)
            {
                case "long_run": return cue.value >= 5 ? "Uzun bir rota!" : "Güzel eşleşme!";
                case "chain": return cue.value + ". zincir!";
                case "cross": return cue.value >= 3 ? "Üç yönde eşleşti!" : "Çapraz eşleşme!";
                case "simultaneous": return "Birden fazla eşleşme!";
                case "green": return "Yeni yerler yeşil!";
                case "doubles": return cue.value + " yer daha yeşil!";
                case "score_goal": return "Puan hedefi tamam!";
                case "ground_goal": return "Her yer yeşil!";
                default: return "";
            }
        }

        private void StartScoreWave(WaveFrame wave, int number)
        {
            if (waveNumber > 0) priorWaveScore += scoreMove.Swap.frames[waveNumber - 1].scoreGain;
            waveNumber = number;
            groundShown = landed = false;
            var headline = scorePlan?.headline;
            if (headline == null || headline.completion || headline.wave != number) headline = null;
            var cue = scorePlan?.waves?.Where(c => c.wave == number).OrderByDescending(c => c.tier).ThenByDescending(c => c.rawTier).FirstOrDefault();
            if (headline != null && (cue == null || headline.tier > cue.tier)) cue = headline;
            if (phoneAudio != null) phoneAudio.Reward(Session,cue);
            bool chain = scoreMove.Swap.frames.Length > 1;
            scorePacket.ShowWave(wave.scoreGain, chain ? number + ". ZİNCİR" : headline != null ? CueText(headline) : "");
            scoreMilestone = scorePlan?.milestones?.Any(m => m.kind == "score" && m.wave == number) == true;
            groundMilestone = scorePlan?.milestones?.Any(m => m.kind == "ground" && m.wave == number) == true;
        }

        private void DrawScoreWave(WaveFrame wave, int number, float phase)
        {
            if (!HasInterface || scoreMove == null || feedbackLayer == null || !feedbackLayer.gameObject.activeSelf) return;
            if (waveNumber != number) StartScoreWave(wave, number);
            if (!groundShown && phase >= HexBoardView.MatchCollected)
            {
                groundShown = true;
                castleHud.ShowGround(wave.layers);
            }

            const float launch = .46f, contact = .79f;
            bool showPacket = phase >= HexBoardView.MatchCollected && phase < contact;
            packet.gameObject.SetActive(showPacket);
            if (showPacket)
            {
                Vector2 origin = feedbackLayer.InverseTransformPoint(boardInput.TransformPoint(
                    UnityEngine.Rect.NormalizedToPoint(boardInput.rect, Board.MatchCenterInViewport)));
                var destination = castleHud.ScoreDestination;
                Vector2 goal = feedbackLayer.InverseTransformPoint(destination.TransformPoint(destination.rect.center));
                float fly = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(launch, contact, phase));
                Vector2 offset = goal - origin;
                Vector2 bend = new Vector2(offset.y, -offset.x).normalized * Mathf.Min(65f, offset.magnitude * .16f);
                packet.localPosition = Vector2.Lerp(origin, goal, fly) + bend * (4f * fly * (1f - fly));

                float bloom = Mathf.InverseLerp(HexBoardView.MatchCollected, launch, phase);
                float size = bloom < .44f ? Mathf.SmoothStep(.46f, 1.29f, bloom / .44f) :
                    Mathf.SmoothStep(1.29f, 1f, (bloom - .44f) / .56f);
                packet.localScale = packetRestScale * Mathf.Lerp(size, .59f, fly);
                scorePacket.ShowHeadline(phase < .57f);
            }
            if (phase < contact) return;
            if (!landed)
            {
                landed = true;
                castleHud.ShowScore(priorWaveScore + wave.scoreGain);
            }
            float progress = Mathf.InverseLerp(contact, 1f, phase);
            float beat = progress < .32f ? Mathf.SmoothStep(0, 1, progress / .32f) :
                Mathf.SmoothStep(1, 0, (progress - .32f) / .68f);
            castleHud.ScaleGoals(1f + beat * (scoreMilestone ? .20f : .15f), 1f + (groundMilestone ? .09f * beat : 0f));
        }

        private void FinishScoreFeedback()
        {
            if (scoreMove == null) return;
            var headline = scorePlan?.headline;
            if (phoneAudio != null && (Board.ReducedMotion || headline?.completion == true))
                phoneAudio.Reward(Session,headline ?? scorePlan?.waves?.OrderByDescending(c => c.tier).FirstOrDefault());
            ClearScoreFeedback();
        }

        private void ClearScoreFeedback()
        {
            scoreMove = null;
            scorePlan = null;
            waveNumber = 0;
            if (packet != null) packet.gameObject.SetActive(false);
            if (feedbackLayer != null) feedbackLayer.gameObject.SetActive(false);
            if (castleHud != null) castleHud.ScaleGoals(1, 1);
        }
    }
}
