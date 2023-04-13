#!/bin/sh

NOW=`date --filename-safe`
DIR="backup-${NOW}"
ARC="${DIR}.tar"
BACKUP_DIR=backups

mkdir ${DIR}
git archive --format=tar HEAD > ${DIR}/code-${NOW}.tar
cd ${DIR}
curl --silent -o "logbook.adi"  'http://localhost:3000/logs?fmt=adi&limit=1000000&since=1900-01-01T00:00:00Z'
curl --silent -o "logbook.cab"  'http://localhost:3000/logs?fmt=cab&limit=1000000&since=1900-01-01T00:00:00Z'
curl --silent -o "logbook.csv"  'http://localhost:3000/logs?fmt=csv&limit=1000000&since=1900-01-01T00:00:00Z'
curl --silent -o "logbook.json" 'http://localhost:3000/logs?fmt=json&limit=1000000&since=1900-01-01T00:00:00Z'
cp ../logbook.sqlite3 .
cd ..

tar -cf ${ARC} ${DIR}
gzip ${ARC}
rm -rf ${DIR}

mkdir -p ${BACKUP_DIR}
mv ${ARC}.gz ${BACKUP_DIR}

echo ${BACKUP_DIR}/${ARC}.gz
