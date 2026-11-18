using System.Collections.Generic;
using System.Linq;
using Hexrota.Gameplay;
using Hexrota.Rewards;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private RectTransform feedbackLayer, packet;
        private Text packetGain, packetCaption;
        private readonly List<Text> flightDigits = new List<Text>();
        private MovePresentation scoreMove;
        private RewardPlan scorePlan;
        private Vector2 matchCenter, hudDestination;
        private int waveNumber, priorWaveScore;
        private bool scoreMilestone, groundMilestone;

        private void CreateScoreFeedback()
        {
            feedbackLayer = Rect("ScoreFeedback",gameplay.transform,Vector2.zero,Vector2.one);
            packet = Rect("ScorePacket",feedbackLayer,Vector2.zero,Vector2.zero);
            packetGain = PlayText("PacketGain",packet,"",0,0,1,.8f,82,new Color32(255,242,166,255),TextAnchor.MiddleCenter,true);
            packetCaption = PlayText("PacketHeadline",packet,"",0,.72f,1,1,21,new Color32(255,243,183,255),TextAnchor.MiddleCenter,true);
            OutlineScore(packetGain); OutlineScore(packetCaption);
            feedbackLayer.gameObject.SetActive(false);
        }

        private static void OutlineScore(Text label)
        {
            var outline = label.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color32(41,72,43,255); outline.effectDistance = new Vector2(2,-3);
        }

        private void BeginScoreFeedback(MovePresentation move)
        {
            ClearScoreFeedback();
            if (!move.Ok || move.Swap == null || move.Swap.frames.Length == 0) return;
            scoreMove = move;
            // An item animates committed evidence, but carries no classic reward plan.
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

        private Vector2 CellInHud(int cell)
        {
            return boardInput.anchorMin + Vector2.Scale(boardInput.anchorMax-boardInput.anchorMin,Board.ViewportCell(cell));
        }

        private void StartScoreWave(WaveFrame wave,int number)
        {
            if (waveNumber > 0) priorWaveScore += scoreMove.Swap.frames[waveNumber-1].scoreGain;
            waveNumber = number;
            var headline = scorePlan?.headline;
            if (headline == null || headline.completion || headline.wave != number) headline = null;
            var cue = scorePlan?.waves?.Where(c => c.wave == number).OrderByDescending(c => c.tier).ThenByDescending(c => c.rawTier).FirstOrDefault();
            if (headline != null && (cue == null || headline.tier > cue.tier)) cue = headline;
            if (phoneAudio != null) phoneAudio.Reward(Session,cue);
            packetCaption.text = headline != null ? CueText(headline) : number > 1 ? number + ". ZİNCİR" : "";
            scoreMilestone = scorePlan?.milestones?.Any(m => m.kind == "score" && m.wave == number) == true;
            groundMilestone = scorePlan?.milestones?.Any(m => m.kind == "ground" && m.wave == number) == true;
            matchCenter = Vector2.zero;
            for (int i=0;i<wave.matched.Length;i++)
            {
                matchCenter += CellInHud(wave.matched[i]) / wave.matched.Length;
                if (flightDigits.Count <= i)
                {
                    var digit = PlayText("MatchedDigit",feedbackLayer,"",0,0,1,1,48,Paper,TextAnchor.MiddleCenter,true);
                    OutlineScore(digit); flightDigits.Add(digit);
                }
                flightDigits[i].text = wave.before[wave.matched[i]].ToString(); flightDigits[i].gameObject.SetActive(true);
            }
            for (int i=wave.matched.Length;i<flightDigits.Count;i++) flightDigits[i].gameObject.SetActive(false);
            Vector2 point = feedbackLayer.InverseTransformPoint(castleHud.ScoreDestination.TransformPoint(castleHud.ScoreDestination.rect.center));
            hudDestination = UnityEngine.Rect.PointToNormalized(feedbackLayer.rect,point);
        }

        private void DrawScoreWave(WaveFrame wave,int number,float phase)
        {
            if (!HasInterface || scoreMove == null || feedbackLayer == null || !feedbackLayer.gameObject.activeSelf) return;
            if (waveNumber != number) StartScoreWave(wave,number);
            float collect = Mathf.SmoothStep(0,1,Mathf.InverseLerp(0,.29f,phase));
            for (int i=0;i<wave.matched.Length;i++)
            {
                var digit = flightDigits[i];
                digit.gameObject.SetActive(collect < 1);
                if (collect >= 1) continue;
                var pos = Vector2.Lerp(CellInHud(wave.matched[i]),matchCenter,collect);
                Place(digit.rectTransform,pos.x-.054f,pos.y-.03f,pos.x+.054f,pos.y+.03f);
                digit.rectTransform.localScale = Vector3.one*(1+Mathf.Sin(collect*Mathf.PI)*.2f-collect*.45f);
            }
            float fly = Mathf.SmoothStep(0,1,Mathf.InverseLerp(.50f,.9f,phase));
            Vector2 center = Vector2.Lerp(matchCenter,hudDestination,fly);
            center.y += Mathf.Sin(fly*Mathf.PI)*.04f;
            Place(packet,center.x-.24f,center.y-.045f,center.x+.24f,center.y+.045f);
            packet.gameObject.SetActive(phase > .1f && phase < .9f);
            packet.localScale = Vector3.one*Mathf.Lerp(1,.34f,fly);
            packetGain.text = "+" + Mathf.RoundToInt(wave.scoreGain*collect);
            float landed = Mathf.InverseLerp(.86f,1,phase);
            castleHud.ShowScore(priorWaveScore + Mathf.RoundToInt(wave.scoreGain*landed));
            float beat = Mathf.Sin(landed*Mathf.PI);
            castleHud.ScaleGoals(1 + beat*(scoreMilestone ? .065f : .035f), 1 + (groundMilestone ? .065f*beat : 0));
        }

        private void FinishScoreFeedback()
        {
            if (scoreMove == null) return;
            var move = scoreMove; var headline = scorePlan?.headline;
            if (phoneAudio != null && (Board.ReducedMotion || headline?.completion == true))
                phoneAudio.Reward(Session,headline ?? scorePlan?.waves?.OrderByDescending(c => c.tier).FirstOrDefault());
            ClearScoreFeedback();
            castleHud.ShowGain(move.Swap.scoreGain);
        }

        private void ClearScoreFeedback()
        {
            scoreMove = null; scorePlan = null; waveNumber = 0;
            if (feedbackLayer != null) feedbackLayer.gameObject.SetActive(false);
            if (castleHud != null)
            {
                castleHud.ShowGain(0);
                castleHud.ScaleGoals(1, 1);
            }
        }
    }
}
