#!/bin/sh

NOW=`date +%Y%m%d%H%M%S`
DIR="backup-${NOW}"
ARC="${DIR}.tar"
BACKUP_DIR=`pwd`/backups

mkdir ${DIR}
git archive --format=tar HEAD > ${DIR}/code-${NOW}.tar
cd ${DIR}
curl --silent -o "logbook.adi"  'http://localhost:3000/qsos?fmt=adi&pageSize=1000000&time_since=00:00:00&date_since=1900-01-01&page=0'
curl --silent -o "logbook.json"  'http://localhost:3000/qsos?fmt=json&pageSize=1000000&time_since=00:00:00&date_since=1900-01-01&page=0'
cp ../logbook.sqlite3 .
cd ..

tar -cf ${ARC} ${DIR}
gzip ${ARC}
rm -rf ${DIR}

mkdir -p ${BACKUP_DIR}
mv ${ARC}.gz ${BACKUP_DIR}

echo ${BACKUP_DIR}/${ARC}.gz
