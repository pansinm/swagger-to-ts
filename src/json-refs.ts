import _ from "lodash";

export function getRefedValue(object: object, ref: string) {
  // 去除'#/'，按'/'分割
  const paths = ref.slice(2).split("/");
  return _.get(object, paths);
}
