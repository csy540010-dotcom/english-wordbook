// Small local starter set. Other entries are requested from the user's existing AI.
const entries = {
  adorable: { phonetic: '/əˈdɔːrəbl/', meaning: 'adj. 可爱的；讨人喜欢的', prompts: ['校园里那些可爱的猫经常吸引学生停下来拍照。', '虽然这只小狗很可爱，但照顾它需要时间和耐心。', '这些可爱的手工作品让更多人关注了这次慈善活动。'] },
  'blow up': { phonetic: '/bləʊ ʌp/', meaning: 'phr. v. 爆炸；给……充气；放大（照片）；突然发怒', prompts: ['学生们放大了这些照片，以便参观者看清细节。', '活动开始前，我们给几个气球充了气。', '遇到不同意见时，我们应该冷静沟通，而不是突然发怒。'] },
  improve: { phonetic: '/ɪmˈpruːv/', meaning: 'v. 提高；改善', prompts: ['经常练习能帮助学生提高写作能力。', '学校正在采取措施改善学生的学习环境。', '为了提高听力，我每天听一小段英语。'] },
  curious: { phonetic: '/ˈkjʊəriəs/', meaning: 'adj. 好奇的；求知欲强的', prompts: ['学生们很好奇，想知道这项技术如何改变日常生活。', '保持好奇心能鼓励我们探索不熟悉的领域。', '虽然这个问题很难，但她仍然想弄清楚原因。'] }
};

// Original starter entries, not a complete or officially graded CET vocabulary.
for (const [word, phonetic, meaning, first, second] of [
  ['benefit', '/ˈbenɪfɪt/', 'n. 好处；益处 v. 使受益；受益', '经常运动对我们的健康有好处。', '学生可以从小组讨论中受益。'],
  ['effort', '/ˈefət/', 'n. 努力；费力的事', '学好一门语言需要持续的努力。', '她努力按时完成了这项任务。'],
  ['available', '/əˈveɪləbl/', 'adj. 可获得的；有空的', '这本书可以在学校图书馆找到。', '你明天下午有空吗？'],
  ['reduce', '/rɪˈdjuːs/', 'v. 减少；降低', '乘坐公共交通可以减少空气污染。', '我们应该减少不必要的开支。'],
  ['require', '/rɪˈkwaɪə/', 'v. 需要；要求', '这项工作需要耐心和细心。', '学校要求学生按时提交作业。'],
  ['develop', '/dɪˈveləp/', 'v. 发展；培养；开发', '阅读可以帮助孩子培养想象力。', '公司正在开发一种新的学习工具。'],
  ['reluctant', '/rɪˈlʌktənt/', 'adj. 不情愿的；勉强的', '他不愿意向别人求助。', '有些学生不愿意在全班面前发言。'],
  ['sustainable', '/səˈsteɪnəbl/', 'adj. 可持续的', '这座城市正在探索更可持续的交通方式。', '我们需要找到一种可持续的发展方式。'],
  ['inevitable', '/ɪnˈevɪtəbl/', 'adj. 不可避免的', '学习新技能时犯错是不可避免的。', '随着技术的发展，一些变化是不可避免的。'],
  ['comprehensive', '/ˌkɒmprɪˈhensɪv/', 'adj. 全面的；综合的', '这份报告全面分析了问题的原因。', '学生需要对这个主题有全面的了解。'],
  ['ambiguous', '/æmˈbɪɡjuəs/', 'adj. 有歧义的；含糊不清的', '他的回答含糊不清，让我们更加困惑。', '这句话有歧义，需要更多背景信息。'],
  ['substantial', '/səbˈstænʃl/', 'adj. 大量的；重大的；实质性的', '这项研究需要大量资金。', '她在写作方面取得了显著进步。'],
  ['feasible', '/ˈfiːzəbl/', 'adj. 可行的', '我们需要判断这个计划是否可行。', '在目前的条件下，这个方案是可行的。'],
  ['resilient', '/rɪˈzɪliənt/', 'adj. 有韧性的；能迅速恢复的', '经历困难之后，她变得更加坚韧。', '这座城市需要建立更有韧性的交通系统。']
]) entries[word] = { phonetic, meaning, prompts: [first, second] };

const starterQuiz = {
  id: 'campus-photos-v1', title: 'More Than a Cute Picture',
  passage: 'When a university photography club planned an exhibition of campus animals, its members expected adorable pictures to attract visitors. They selected their most popular photographs and decided to blow up several images for a display near the library. At first, the project appeared to be little more than a pleasant break from academic work.\n\nDuring preparation, however, the students discovered that a successful exhibition required more than attractive images. A photograph of a cat resting beside a bicycle received many positive comments online, but it revealed almost nothing about the animal’s situation. The group therefore added short accounts from people who regularly cared for the campus cats. These described the time, patience and cooperation involved in providing responsible care.\n\nThe additional information changed how some visitors responded. Instead of simply taking photographs of the display, they asked how they could help. Yet the club avoided suggesting that every interested student should immediately adopt an animal. Members explained that enthusiasm alone was insufficient: students also needed to consider their schedules and living arrangements.\n\nThe exhibition did not measure its success only by attendance. The organisers were more interested in whether visitors left with a better understanding of the responsibilities behind the appealing images. The project suggested that attractive presentation can draw attention, but useful context is what helps turn that attention into thoughtful decisions.',
  questions: [
    { question: 'Why did the club add accounts from people who cared for the cats?', options: ['To make the exhibition easier to advertise online.', 'To explain responsibilities that the photographs did not show.', 'To encourage visitors to judge the quality of each photograph.', 'To replace the photographs that had received few comments.'], answer: 1, explanation: '第二段指出照片几乎没有交代动物的处境，补充文字说明了照顾动物所需的时间、耐心和合作，因此选 B。' },
    { question: 'What can be inferred about the club’s attitude towards animal adoption?', options: ['It should be the main goal of every campus exhibition.', 'It is suitable for anyone who finds animals attractive.', 'It requires practical consideration as well as enthusiasm.', 'It is less valuable than sharing animal pictures online.'], answer: 2, explanation: '第三段说热情本身不够，还需考虑日程和居住条件。由此可推断，应同时考虑意愿与现实条件。' },
    { question: 'What is the main message of the passage?', options: ['An appealing display becomes more meaningful when it provides useful context.', 'Online popularity is the best measure of an exhibition’s success.', 'Student clubs should focus on entertainment rather than practical issues.', 'Large photographs are more effective than personal accounts.'], answer: 0, explanation: '末段总结全文：吸引人的展示获得注意，有用的背景信息则帮助人们作出经过思考的决定。A 最完整，其他选项与文意不符。' }
  ]
};
const translations = {
  adorable: [
    { sentence: 'Although the adorable animals featured in online videos may encourage people to adopt a pet, researchers warn that decisions based mainly on appearance often overlook the long-term responsibilities that caring for an animal involves.', reference: '尽管网络视频中那些可爱的动物可能会促使人们领养宠物，但研究人员警告说，主要基于外表作出的决定往往忽视了照顾动物所涉及的长期责任。', structure: 'Although 引导让步状语从句；featured in online videos 是过去分词短语，修饰 animals；that 引导 warn 的宾语从句；末尾 that caring for an animal involves 是修饰 responsibilities 的定语从句。' },
    { sentence: 'What makes the exhibition memorable is not merely the collection of adorable photographs, but the stories behind them, which remind visitors that even small acts of kindness can make a lasting difference to their community.', reference: '让这次展览令人难忘的，不仅是那些可爱的照片，还有照片背后的故事；这些故事提醒参观者，即使是小小的善举，也能给他们所在的社区带来持久的影响。', structure: 'What 引导主语从句；not merely ... but ... 连接表语；which 引导非限制性定语从句，修饰 stories；that 引导 remind 的内容从句。' }
  ],
  'blow up': [
    { sentence: 'Before the museum agreed to blow up the photographs for its new exhibition, the researchers checked whether the details that would become visible at a larger size were clear enough to support their conclusions.', reference: '在博物馆同意为新展览放大这些照片之前，研究人员检查了那些在放大后会显现出来的细节是否足够清晰，能够支持他们的结论。', structure: 'Before 引导时间状语从句；whether 引导 checked 的宾语从句；that would become visible at a larger size 修饰 details；enough to 表示达到某种程度；blow up 在此意为放大。' },
    { sentence: 'Although digital tools allow users to blow up an image almost instantly, the extra detail they appear to reveal may be produced by software rather than recorded by the camera, a distinction that is easy to overlook.', reference: '尽管数字工具能让用户几乎瞬间放大图像，但这些工具看似显示出的额外细节可能是由软件生成的，而不是由相机记录的；这一差别很容易被忽视。', structure: 'Although 引导让步；they appear to reveal 是省略关系代词的定语从句，修饰 detail；rather than 表对比；a distinction 概括前述差别，that 引导定语从句修饰 distinction。' }
  ]
};
module.exports = { entries, starterQuiz, translations };

