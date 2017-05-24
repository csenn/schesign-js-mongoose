import isString from 'lodash/isString'
import isArray from 'lodash/isArray'
import isNumber from 'lodash/isNumber'
import fs from 'fs'
import path from 'path'

const filePath = path.resolve(__dirname, '..', 'templates', 'model.txt')

const getTab = num => {
  let result = ''
  for (let i = 0; i < num; i++) {
    result += '  '
  }
  return result
}

const JS_VARS = [
  'Boolean',
  'String',
  'Number',
  'Date',
  'true',
  'false',
  'mongoose.Schema.Types.ObjectId'
]

function _addText (config, range) {
  config.type = 'String'
  if (range.regex) {
    config.match = range.regex
  }
}

function _addNumber (config, range) {
  config.type = 'Number'
  if (isNumber(range.min)) {
    config.min = range.min
  }
  if (isNumber(range.max)) {
    config.max = range.max
  }
}

function _addLinkedClass (context, config, range) {
  const linked = context.classCache[range.ref]
  config.type = 'mongoose.Schema.Types.ObjectId'
  config.ref = linked.label
}

function _getSpecConfig (context, propertySpec, property, path) {
  const { range } = property

  let config = {}
  switch (range.type) {
    case 'Boolean':
      config.type = 'Boolean'
      break
    case 'Text':
      _addText(config, range)
      break
    case 'Date':
      config.type = 'Date'
      break
    case 'Number':
      _addNumber(config, range)
      break
    case 'Enum':
      config.enum = range.values
      break
    case 'NestedObject':
      if (path.includes(property.label)) {
        break
      }
      path.push(property.label)
      Object.assign(config, _buildConfig(context, range.propertySpecs, path))
      break
    case 'LinkedClass':
      _addLinkedClass(context, config, range)
      break

    default:
      throw new Error(`Not expecting type: ${range.type}`)
  }

  if (propertySpec.required) {
    config.required = 'true'
  }

  if (propertySpec.index) {
    config.index = 'true'
  }

  if (propertySpec.unique) {
    config.unique = 'true'
  }

  if (propertySpec.array) {
    config = [config]
  }

  return config
}

function _buildConfig (context, propertySpecs, path = []) {
  const obj = {}

  propertySpecs.forEach(propertySpec => {
    const property = context.propertyCache[propertySpec.ref]
    obj[property.label] = _getSpecConfig(context, propertySpec, property, path)
  })

  return obj
}

function _buildString (config, depth = 1) {
  let str = ''
  if (isString(config)) {
    str += JS_VARS.includes(config)
      ? config
      : `'${config}'`
  } else if (isNumber(config)) {
    return config
  } else if (isArray(config)) {
    str += '['
    if (config.length > 1) {
      str += '\n'
      const last = config.length - 1
      config.forEach((c, index) => {
        str += `${getTab(depth)}${_buildString(c, depth)}`
        if (last === index) {
          str += '\n'
        } else {
          str += ',\n'
        }
      })
    } else {
      config.forEach(c => {
        str += _buildString(c, depth)
      })
    }
    if (config.length > 1) {
      str += `${getTab(depth - 1)}]`
    } else {
      str += ']'
    }
  } else {
    const keys = Object.keys(config)
    const last = keys.length - 1
    str += '{\n'
    keys.forEach((childKey, index) => {
      str += `${getTab(depth)}${childKey}: `
      str += _buildString(config[childKey], depth + 1)
      if (last === index) {
        str += '\n'
      } else {
        str += ',\n'
      }
    })
    str += `${getTab(depth - 1)}}`
  }

  return str
}

/* If there is a property label lower in the hierarchy,
do not overwrite it from parent with same name */
function existsInRefs (context, propertySpecs, parentRef) {
  return propertySpecs.some(ref => {
    const node = context.propertyCache[ref.ref]
    const parentNode = context.propertyCache[parentRef.ref]
    return node.label === parentNode.label
  })
}

export function _flattenHierarchies (context) {
  Object.keys(context.classCache).forEach(key => {
    const classNode = context.classCache[key]
    const excluded = []

    // classNode.excludeParentProperties || []
    const recurseNode = node => {
      if (node.subClassOf) {
        const parent = context.classCache[node.subClassOf]
        parent.propertySpecs.forEach(parentRef => {
          if (node.excludeParentProperties) {
            excluded.push(...node.excludeParentProperties)
          }
          const exists = existsInRefs(context, classNode.propertySpecs, parentRef)
          if (!exists) {
            classNode.propertySpecs.push(parentRef)
          }
        })
        recurseNode(parent)
      }
    }
    recurseNode(classNode)
    classNode.propertySpecs = classNode.propertySpecs.filter(spec => excluded.indexOf(spec.ref) === -1)
  })
}

export function generateFromClass (graph, classUid, opts = {}) {
  /* Create a simple context obj to thread through */
  const context = {
    classCache: {},
    propertyCache: {},
    definitions: {}
  }

  /* Create a dict lookup for classes and properties for speed and convenience */
  graph.forEach(node => {
    if (node.type === 'Class') {
      context.classCache[node.uid] = node
    } else if (node.type === 'Property') {
      context.propertyCache[node.uid] = node
    }
  })

  _flattenHierarchies(context)

  const currentClass = context.classCache[classUid]
  if (!currentClass) {
    throw new Error(`Could not find class ${classUid} in graph`)
  }

  const config = _buildConfig(context, currentClass.propertySpecs)
  const fields = _buildString(config)

  let modelTemplate = fs.readFileSync(filePath, 'utf-8')
  modelTemplate = modelTemplate.replace(/{modelName}/, currentClass.label)
  modelTemplate = modelTemplate.replace(/{fields}/, fields)

  return modelTemplate
}
