import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'coordination',name),'utf8'));
const code=read('code-status.json'),art=read('blender-status.json'),queue=read('integration-queue.json');
const clean=value=>String(value??'—').replace(/[\r\n|]/g,' ');
const link=(label,relative)=>`[${label}](<${path.resolve(root,relative).replaceAll('\\','/')}>)`;
const list=items=>(items??[]).length?items.map(s=>`- ${s}`).join('\n'):'- لا طلب مسجل.';
const active=record=>(record.claimedPaths??[]).map(s=>'`'+s+'`').join('، ');
const rows=queue.batches.map(b=>`| ${clean(b.id)} | ${clean(b.status)} | ${clean(b.summary)} |`).join('\n');
const document=`# ASHFALL — ملف المشروع الرئيسي المشترك

هذا هو مرجع العمل الواحد للوكيلين. جميع الملفات موجودة تحت مجلد المشروع الحالي؛ لا توجد نسخة تشغيل ثانية. تاريخ توليد الصفحة: ${new Date().toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'})} بتوقيت الرياض. حالة كل وكيل أدناه تعكس آخر تقرير محفوظ، ولا تعني متابعة لحظية للمحادثات.

## أين ملفات المشروع؟

| المحتوى | المسار المعتمد |
| --- | --- |
| أكواد اللعبة ونسخة التشغيل | ${link('مجلد اللعبة','outputs/house-game')} |
| كل المصادر السابقة والصور والحزم | ${link('مجلد الملفات الكامل','outputs')} |
| مصدر Blender قبل تسليم v1 | ${link('ashfall-combat-update.blend','outputs/ashfall-combat-update.blend')} |
| آخر تحديث برمجي | ${link('سجل آخر نسخة','outputs/house-game/CHANGELOG.md')} |
| ملف Blender الحالي الملاحظ في التسليم | ${link('ashfall-remaster-v1.blend','outputs/blender-delivery/ashfall-remaster-v1.blend')} |
| تسليمات Blender الجديدة | ${link('مجلد التسليمات','outputs/blender-delivery')} |
| دليل أول دفعة بصرية | ${link('دليل الدمج','outputs/blender-delivery/INTEGRATION-GUIDE.md')} |
| مهام Blender الكاملة | ${link('قائمة84 بندًا','outputs/ashfall-blender-handoff.md')} |
| الخطة العامة | ${link('خطة التطوير','outputs/ashfall-development-plan.md')} |
| المراجعة النقدية | ${link('الملاحظات المئة','outputs/ashfall-expert-review.md')} |
| توقيتات الاشتباك وربط الحركات | ${link('عقد الربط','outputs/house-game/COMBAT-CONTRACT.md')} |
| نتائج الاختبار البرمجي | ${link('نتائج التحقق الحالية',code.verificationPath??'outputs/ashfall-update-05-verification.md')} |
| ملاحظات الدمج لوكيل Blender | ${link('التفاصيل والنواقص المتبقية','outputs/ashfall-blender-v1-integration-feedback.md')} |
| قواعد العمل بين الوكيلين | ${link('طريقة التعاون','coordination/PROTOCOL.md')} |
| اختبار اللعبة بآخر صادرات Blender | [المعاينة المحلية المباشرة](http://127.0.0.1:8124/?delivery=1) |
| فحص الأصول قبل الدمج | [عارض الأصول المحلي](http://127.0.0.1:8124/__review/index.html) |
| تعليمات التحديث بعد حفظ التسليم | ${link('طريقة المعاينة المشتركة','coordination/LIVE-PREVIEW.md')} |
| ملاحظات الدفعة الثانية | ${link('حالة الأسلحة وتصحيح الطابق المطلوب','outputs/ashfall-blender-v2-integration-feedback.md')} |

## النسخة الحالية

**${clean(code.release?.label)}** — [افتح اللعبة](${code.release?.url}). المصدر المنشور: \`${clean(code.release?.commit)}\`. الأصول البصرية الجديدة لا تعد منشورة حتى تسجل قائمة الدمج ذلك صراحة.

## من يعمل على ماذا الآن؟

| الوكيل | آخر حالة محفوظة | المهمة الحالية | مصدر التقرير |
| --- | --- | --- | --- |
| البرمجة والربط والصوت | ${clean(code.state)} | ${clean(code.currentTask)} | ${clean(code.updatedBy)} |
| Blender والبصريات | ${clean(art.state)} | ${clean(art.currentTask)} | ${clean(art.updatedBy)} |

آخر تحديث البرمجة: ${clean(code.updatedAt)}. آخر تحديث حالة Blender: ${clean(art.updatedAt)}. إذا كانت حالة Blender ملاحظة من وكيل البرمجة فهي ليست تأكيد اكتمال من صاحب الأصول.

**ملفات العمل المحجوزة للبرمجة:** ${active(code)}.

**ملفات العمل المحجوزة لـBlender:** ${active(art)}.

## ما أنجزه وكيل البرمجة؟

${list(code.completed)}

## ما يطلبه وكيل البرمجة من Blender؟

${list(code.needsFromOtherAgent)}

## ما يحتاجه Blender من البرمجة؟

${list(art.needsFromOtherAgent)}

## التسليمات والدمج

| الدفعة | الحالة المسجلة | الوصف |
| --- | --- | --- |
${rows||'| — | لا دفعات | — |'}

${link('قائمة الدمج مع الملفات والبصمات ونتائج الفحص','coordination/integration-queue.json')}. وجود الملف يعني أنه موجود فقط؛ لا يعني أنه فُحص أو دُمج أو نُشر.

## سجل كل وكيل وملف حالته

- ${link('حالة البرمجة','coordination/code-status.json')} — ${link('سجل البرمجة','coordination/code-log.md')}.
- ${link('حالة Blender','coordination/blender-status.json')} — ${link('سجل Blender','coordination/blender-log.md')}.

يقرأ كل وكيل حالة الآخر قبل العمل، ويحدّث ملف حالته وسجله هو عند التسليم، ثم يشغّل \`node coordination/update-project-index.mjs\` من مجلد المشروع. ملفا الحالة منفصلان لمنع الكتابة فوق عمل الطرف الآخر. هذا الملف مولّد؛ حدّث الحالات بدل تعديل محتواه يدويًا.
`;
fs.writeFileSync(path.join(root,'PROJECT.md'),document);
console.log('Updated PROJECT.md from the shared status files.');
