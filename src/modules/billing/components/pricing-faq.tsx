import { useI18n } from "@/i18n/react";
const questions = (freeCredits: number) => [
  {
    question: "可以先免费试用吗？",
    answer: `可以。新账户赠送 ${freeCredits} 积分，你也可以在注册前浏览工具和查看预置示例。示例不消耗积分。`,
  },
  {
    question: "同一套餐选择年付，积分和功能会变化吗？",
    answer:
      "月付和年付共享套餐功能与每月积分。年付一次支付全年费用，按月发放积分，共 12 期；价格卡会展示全年实付、折合月价和相对逐月付款的节省金额。兑换年付套餐也按月发放，用户信息中可查看下次发放时间。",
  },
  {
    question: "订阅和一次性积分包有什么区别？",
    answer:
      "月付订阅每月扣款并发放当月积分；年付订阅一次支付全年费用，积分每月发放一次，共 12 次。一次性积分包只支付一次，不会自动续费，购买的积分会加入现有余额。",
  },
  {
    question: "积分怎么扣？生成失败怎么办？",
    answer:
      "每次成功生成消耗 1 积分。生成开始时会预扣积分，生成失败会退回，余额与变动记录可以在“积分与账单”中查看。",
  },
  {
    question: "付款后积分什么时候到账？",
    answer:
      "服务端确认支付成功后发放积分。付款完成但页面尚未更新时，可以刷新“套餐与订单”。持续未到账请联系站点支持，不需要再次购买。",
  },
  {
    question: "取消订阅后还能使用吗？",
    answer:
      "取消订阅会停止后续续费，已经支付的周期权益保留到期。已发放积分不会因为取消续费自动撤回；退款则会撤回对应积分。",
  },
  {
    question: "价格使用什么币种？",
    answer: "页面价格以美元显示和结算，付款前可以在收银台确认订单金额。",
  },
];
export function PricingFaq({ freeCredits }: { freeCredits: number }) {
  const { t: tr, locale } = useI18n();
  return (
    <section className="pricing-faq" aria-labelledby="pricing-faq-title">
      <div className="pricing-faq-heading">
        <h2 id="pricing-faq-title">{tr("常见问题")}</h2>
        <p>{tr("关于试用、积分、付款和订阅。")}</p>
      </div>
      <div className="faq-list">
        {questions(freeCredits).map(({ question, answer }) => (
          <details key={tr(question)}>
            <summary>
              {tr(question)}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{tr(answer)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
