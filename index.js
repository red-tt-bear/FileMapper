const fileUtils = require('./utils/fileUtils');
const objectUtils = require('./utils/objectUtils');
const path = require('path');
const fs = require('fs');

console.log(`Arguements: ${JSON.stringify(process.argv, null, 2)}`);

const map = async (startFilePath, outFilePath) => {
  const results = {};
  await new Promise(async resolve => {
    await fileUtils.traverse({
      filePath: startFilePath,
      onFile: async (filePath) => {
        const hash = await fileUtils.sha1(filePath);
        results[hash] = results[hash] || [];
        results[hash].push(filePath);
      },
      onDone: resolve
    });
  });
  const s = JSON.stringify(results, null, 2);
  if (!outFilePath) {
    console.log(s);
  } else {
    await fileUtils.writeFile(outFilePath, s);
  }
  return results;
}

const diff = async (firstFile, secondFile) => {
  if (!firstFile) {
    console.error("diff requires a two files to read from, received none");
    process.exit(1);
  }
  if (!secondFile) {
    console.error("diff requires a two files to read from, received one");
    process.exit(1);
  }

  const firstFileString = await fileUtils.readFile(firstFile);
  const secondFileString = await fileUtils.readFile(secondFile);
  const firstArray = Object.keys(JSON.parse(firstFileString));
  const secondArray = Object.keys(JSON.parse(secondFileString));
  const diff = objectUtils.diffArray({
    firstArray,
    secondArray
  });
  console.log(JSON.stringify(diff, null, 2));
}

const dups = async (inFilePath) => {
  if (!inFilePath) {
    console.error("dups requires a file path to read from");
    process.exit(1);
  }
  const dupsMapString = await fileUtils.readFile(inFilePath);
  const dupsMap = JSON.parse(dupsMapString);
  const resultDupsMap = Object.keys(dupsMap)
  .filter(key => dupsMap[key].length > 2)
  .reduce((result, value) => {
    result[value] = dupsMap[value]
    return result;
  }, {});
  console.log(JSON.stringify(resultDupsMap, null, 2));
}

const sync = async (sourcePath, destinationPath) => {
  const readOrGenerateMap = async (filePath, mapDest, mapName) => {
    const stats = fs.lstatSync(filePath);
    if(stats.isFile()) {
      const fileContent = await fileUtils.readFile(filePath);
      return JSON.parse(fileContent);
    } else if(stats.isDirectory()) {
      return map(filePath, path.join(mapDest, mapName));
    } else {
      throw new Error(`Cannot read for reading or generating map ${filePath}`);
    }
  }

  let destinationDirectory = destinationPath;
  let destStats = fs.lstatSync(destinationPath);
  if(destStats.isFile()) {
    destinationDirectory = path.dirname(destinationPath);
  } else if (!destStats.isDirectory()) {
    throw new Error(`Cannot read destination file ${destinationPath}`);
  }

  const destinationObj = await readOrGenerateMap(destinationPath, destinationDirectory, "destination.map.json");
  const sourceObj = await readOrGenerateMap(sourcePath, destinationDirectory, "source.map.json");

  const firstArray = Object.keys(sourceObj);
  const secondArray = Object.keys(destinationObj);
  const diff = objectUtils.diffArray({
    firstArray,
    secondArray
  });
  for(let i = 0; i < diff.firstArrayExclusive.length; i++) {
    const item = diff.firstArrayExclusive[i];
    const ext = path.extname(sourceObj[item][0]);
    await fileUtils.copyFile(sourceObj[item][0], path.join(destinationDirectory, `${item}${ext}`));
  }
}

// arg 0: node exe path
// arg 1: path to run script
// arg 2: command
(async () => {
  const command = process.argv[2];
  switch(command) {
  case "map":
  const startFilePath = process.argv[3] || ".";
  const outFilePath = process.argv[4];
  await map(startFilePath, outFilePath);
  break;
  case "diff":
  const firstFile = process.argv[3];
  const secondFile = process.argv[4];
  await diff(firstFile, secondFile);
  break;
  case "dups":
  const inFilePath = process.argv[3];
  await dups(inFilePath);
  break;
  case "sync":
  const inFilePathSync = process.argv[3];
  const destinationPath = process.argv[4];
  await sync(inFilePathSync, destinationPath);
  break;
  case "usage":
  console.log("TODO");
  break;
  default:
  console.log(`Invalid command "${command}"`)
}
})();
