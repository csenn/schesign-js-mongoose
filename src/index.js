import fs from 'fs';
import path from 'path';

const nodes = [
  {
    label: 'one',
    range: {
      type: 'Text',
    },
  },
  {
    label: 'two',
    range: {
      type: 'Boolean',
    },
  },
];

const filePath = path.resolve(__dirname, '..', 'templates', 'model.txt');
let modelTemplate = fs.readFileSync(filePath, 'utf-8');

const getTab = num => {
  let result = '';
  for (let i = 0; i < num; i++) {
    result += '  ';
  }
  return result;
};

const modelName = 'Cheese';
const schemaName = `${modelName}Schema`;

// function renderObject () {

// }

const special = [
  {
    key: 'one',
    value: [
      { key: 'type', value: 'Text' },
    ],
  },
  {
    key: 'Blam',
    value: [
      { key: 'type', value: 'Date' },
    ],
  },
  {
    key: 'two',
    isArray: true,
    value: [
      {
        key: 'one',
        value: [
          { key: 'type', value: 'Boolean' },
        ],
      },
      {
        key: 'three',
        value: [
          { key: 'type', value: 'Text' },
        ],
      },
    ],
  },
];


function getFields(arr, depth = 1) {
  let fields = '{\n';

  const last = arr.length - 1;
  arr.forEach((node, index) => {
    fields += `${getTab(depth)}${node.key}: `;

    if (node.isArray) {
      fields += '[';
    }

    if (Array.isArray(node.value)) {
      fields += getFields(node.value, depth + 1);
    } else {
      fields += `${node.value}`;
    }

    if (node.isArray) {
      fields += ']';
    }


    if (last === index) {
      fields += '\n';
    } else {
      fields += ',\n';
    }
  });

  fields += `${getTab(depth - 1)}}`;
  return fields;
}

const fields = getFields(special);

// let fields = '{\n';
// const last = fields.length - 1;
// nodes.forEach((node, index) => {
//   fields += `${getTab(1)}${node.label}: ${node.range.type}`;
//   if (last === index) {
//     fields += '\n';
//   } else {
//     fields += ',\n';
//   }
// });

// fields += '}';


modelTemplate = modelTemplate.replace(/{modelName}/, modelName);
modelTemplate = modelTemplate.replace(/{schemaName}/g, schemaName);
modelTemplate = modelTemplate.replace(/{fields}/, fields);


console.log(modelTemplate);
