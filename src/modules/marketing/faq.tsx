import { useI18n } from "@/i18n/react";
export function FaqSection({
  standalone = false,
  freeCredits = 0,
}: {
  standalone?: boolean;
  freeCredits?: number;
}) {
  const { t: tr, locale } = useI18n();
  const Heading = standalone ? "h1" : "h2";
  return (
    <section className="marketing-faq container" id="faq">
      <div className="marketing-heading">
        <Heading>{tr("你可能想知道")}</Heading>
        <p>{tr("开始之前，先了解这些小事。")}</p>
      </div>
      <div className="faq-list">
        {[
          [
            tr("需要先注册才能查看工具吗？"),
            tr(
              "不用。你可以直接浏览所有工具、填写内容和查看预置示例。真实生成需要登录，登录后会回到原工具并恢复当前标签页中的草稿。",
            ),
          ],
          [
            tr("这些示例是实时生成的吗？"),
            tr(
              "不是。首页和工具页中的示例是预置内容，用来说明工具用途，不会消耗积分。真实 AI 生成需要站点启用模型服务。",
            ),
          ],
          [
            tr("积分怎么计算？"),
            tr(
              "新账户赠送 {0} 积分。每次成功生成消耗 1 积分，生成失败会退回。积分使用记录可在账户的积分与账单中查看。",
              [freeCredits],
            ),
          ],
          [
            tr("取消订阅后还能使用吗？"),
            tr(
              "取消订阅会停止后续续费，已经支付的周期权益保留到期。已发放积分不会因为取消续费自动撤回；退款则会撤回对应积分。",
            ),
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>
              {tr(q)}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
