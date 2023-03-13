#!/bin/sh

NOW=`date --filename-safe`
DIR="backup-${NOW}"
ARC="${DIR}.tar"
BACKUP_DIR=backups

mkdir ${DIR}
git archive --format=tar HEAD > ${DIR}/code-${NOW}.tar
cd ${DIR}
curl --silent -o "logbook.adi" http://localhost:3000/logs?fmt=adi
curl --silent -o "logbook.json" http://localhost:3000/logs?fmt=json
cp ../logbook.sqlite3 .
cd ..

tar -cf ${ARC} ${DIR}
gzip ${ARC}
rm -rf ${DIR}

mkdir -p ${BACKUP_DIR}
mv ${ARC}.gz ${BACKUP_DIR}

echo ${BACKUP_DIR}/${ARC}.gz
