// 规则识别使用 Oracle 身份，不依赖中文翻译或图片印次。
// 来源与2026-08-19 CR条文见 docs/planechase-review.md。
const PLANAR_ACTIONS = Object.freeze({
  "6dc67a65-31bf-4535-9e02-8f6d6ecefde5": "aether",
  "aa166578-b13b-4adb-a78e-d5183e987112": "merge",
  "ab72ff80-738a-4468-aecf-5d806143f791": "append",
  "2f3e71b6-0fd6-4ac5-a265-faaabe21177b": "echo"
});

// v1存档使用的固定下标顺序；每个位置对应的Oracle身份不得重排或重新生成。
const LEGACY_CARD_IDS = Object.freeze([
  "cd8ce6f1-9753-40a7-a625-5ed63c15c29e",
  "8eb442a9-5e61-4e2e-983d-b49b04be2575",
  "6dc67a65-31bf-4535-9e02-8f6d6ecefde5",
  "c871974e-54e6-411f-8408-3708823fa2df",
  "f3b27908-ca10-4793-ab8e-6639c73cfadd",
  "2732b605-7c88-4995-b46e-62dc09e68919",
  "3fc15821-1add-4321-aecd-33f8a8c5f9a7",
  "0ff2bbed-e435-4108-b02a-564a75abba40",
  "2387edac-765b-4502-bd3d-88be8ba7d0a4",
  "9aa94de8-b114-4479-a771-c7bc0297be58",
  "a0cb118e-6af1-41d2-847f-d685ced2165d",
  "256770fe-c17d-45dd-bf05-36eeee240324",
  "38bdd034-0375-403c-97ca-6f93a5e12e54",
  "a7c6b72c-f9ec-4048-8e4c-99210e4e7b85",
  "1300b5e7-d741-4723-bb15-dabd04cb0c11",
  "f3f5a033-d063-4250-9cfe-4c3c1a2725f1",
  "ff76b576-8ad3-44f9-8043-80003a078e84",
  "aa166578-b13b-4adb-a78e-d5183e987112",
  "6552e3dd-ce35-4267-a25e-f5d4dceb8311",
  "c907333b-eae8-444f-9da3-b193289f19e2",
  "c5f0da12-b76f-42fb-a52e-cd09535e72fb",
  "cb7ae16a-9982-4782-9e20-07bb771d0601",
  "a2048704-0d22-435d-b819-269291f2981e",
  "2f3e71b6-0fd6-4ac5-a265-faaabe21177b",
  "503fcc43-dafd-484b-a97f-bbd11eed66de",
  "022e38c3-fcea-428f-a0d0-a6cca057faa3",
  "08427dab-3874-4a29-bd63-cbd16c1d229d",
  "a34b272b-084b-4ff1-8b02-d95116ccfeab",
  "b60e8617-fc35-4c8a-beb0-4688b88484c4",
  "86534917-5d51-4eba-9bf5-f9fc93c83c80",
  "d858e6db-9842-41d1-8006-574c8dcd98ed",
  "3c200cc0-02b1-4a32-a910-5cd3c4d716b7",
  "61c5f2cb-f39c-487c-9786-a8dad4663f4f",
  "91fe554b-13db-451d-ab25-717ab2b70649",
  "43a23de7-0738-4b03-b87d-5a7d1144825c",
  "00f00001-bd84-4dbf-a707-f4b1549100d4",
  "0a4bf88d-106a-413b-9d80-8775c1ff5ded",
  "3e553881-bac7-4830-b739-3b8c6aa0ded6",
  "f017380f-97db-4a36-b111-b257aa17ebaf",
  "4eebfaf3-18da-4661-b6a5-d874585e170a",
  "1f7daaf2-3206-4f52-928a-f5116b782367",
  "ab72ff80-738a-4468-aecf-5d806143f791",
  "61b5984a-de6a-4d5a-8b20-e2fb3b553a34",
  "8c56bb41-a8d8-4b0f-bbb7-be8466dc9ed1",
  "6e008fdc-48f2-40ef-95bd-80d014535ca3",
  "ce8139b9-31f3-464d-86ea-7efbdbfce478",
  "4abae901-eb47-4318-bf64-322a893c2833",
  "93b3acc1-2d41-4f5f-9225-7a30ea2d8158",
  "0c1cb8e2-8ed4-4a0e-926b-4df5466c607c",
  "c09d304a-87d0-4a2a-bcb2-e81341b2dbf2"
]);

module.exports = { PLANAR_ACTIONS, LEGACY_CARD_IDS };
