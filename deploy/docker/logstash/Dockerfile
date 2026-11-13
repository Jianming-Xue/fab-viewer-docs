# 基于本机已拉取的 logstash:9.5.5（仓库要求 Logstash 9.x），只补装输出插件
# 插件 logstash-output-opensearch 必须 2.x（1.x 不支持 Logstash 8+，50-output.conf 注明）
# 构建时校验版本号 2.x，装错直接让 build 失败
FROM logstash:9.5.5
RUN LS_JAVA_OPTS="-Xmx2g" /usr/share/logstash/bin/logstash-plugin install logstash-output-opensearch \
 && /usr/share/logstash/bin/logstash-plugin list --verbose | grep -E 'logstash-output-opensearch \(2\.'
