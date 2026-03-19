# 写入表头（仅执行一次）
echo "Timestamp,Container,CPU_Perc,Mem_Usage,Net_IO" > stats.csv

while true; do
  docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}}" | while read line; do
    echo "$(date +%T),$line" >> stats.csv
  done
  sleep 5
done
