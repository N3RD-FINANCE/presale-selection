const stringify = require('csv-stringify');
const fs = require('fs');

module.exports = {
    writeCSV: function (fileName, objData, columns) {
        let data = [];
        for (const k of Object.keys(objData)) {
            data.push([k, objData[k]]);
        }
        stringify(data, { header: true, columns: columns }, (err, output) => {
            if (err) throw err;
            fs.writeFile(fileName, output, (err) => {
                if (err) throw err;
                console.log(fileName + ' saved.');
            });
        });
    }
}