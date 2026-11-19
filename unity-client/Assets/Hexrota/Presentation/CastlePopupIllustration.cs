using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed class CastlePopupIllustration : MonoBehaviour
    {
        [SerializeField] private Image subject;
        [SerializeField] private GameObject rewardDecor;

        internal void Bind(Sprite art,bool isReward)
        {
            subject.sprite=art;
            rewardDecor.SetActive(isReward);
        }
    }
}
