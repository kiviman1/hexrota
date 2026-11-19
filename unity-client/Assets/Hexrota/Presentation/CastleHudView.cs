using System.Globalization;
using Hexrota.Gameplay;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent]
    public sealed class CastleHudView : MonoBehaviour
    {
        [Header("Oyun")]
        [SerializeField] private Text remainingMoves;
        [SerializeField] private Button settings;

        [Header("Hedefler")]
        [SerializeField] private Text scoreCount;
        [SerializeField] private Text groundCount;
        [SerializeField] private RectTransform scoreProgress;
        [SerializeField] private RectTransform groundProgress;
        [SerializeField] private string progressFormat = "{current} / {target}";

        [Header("Eşleşme geri bildirimi")]
        [SerializeField] private RectTransform scoreGoal;
        [SerializeField] private RectTransform groundGoal;
        private Vector3 scoreRestScale, groundRestScale;
        private int scoreTarget;

        internal RectTransform ScoreDestination => scoreCount.rectTransform;
        internal bool IsReady => settings != null && scoreCount != null && remainingMoves != null &&
            groundCount != null && scoreProgress != null && groundProgress != null;

        internal void Bind(FirstPlayableController game)
        {
            if (settings != null) settings.onClick.AddListener(game.OpenMobileSettings);
        }

        private void Awake()
        {
            scoreRestScale = scoreGoal.localScale;
            groundRestScale = groundGoal.localScale;
        }

        internal void ShowStage(int target, GameSnapshot snapshot)
        {
            ShowMoves(snapshot.movesLeft);
            ShowGround(snapshot.layers);
            scoreTarget = target;
            ShowScore(snapshot.score);
        }

        internal void ShowMoves(int moves)
        {
            remainingMoves.text = moves.ToString(CultureInfo.InvariantCulture);
        }

        internal void ShowGround(int[] layers)
        {
            int green = 0;
            foreach (int remaining in layers)
                if (remaining == 0) green++;
            ShowProgress(groundCount, groundProgress, green, layers.Length);
        }

        internal void ShowScore(int score)
        {
            ShowProgress(scoreCount, scoreProgress, score, scoreTarget);
        }

        private void ShowProgress(Text label, RectTransform fill, int current, int target)
        {
            label.text = progressFormat.Replace("{current}", current.ToString(CultureInfo.InvariantCulture))
                .Replace("{target}", target.ToString(CultureInfo.InvariantCulture));
            float fraction = target > 0 ? Mathf.Clamp01((float)current / target) : 1f;
            fill.anchorMax = new Vector2(fraction, fill.anchorMax.y);
            fill.gameObject.SetActive(fraction > 0);
        }

        internal void ScaleGoals(float score, float ground)
        {
            if (scoreGoal != null) scoreGoal.localScale = scoreRestScale * score;
            if (groundGoal != null) groundGoal.localScale = groundRestScale * ground;
        }
    }
}
