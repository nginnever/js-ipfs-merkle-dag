var uniqueBy = require('unique-by')
var deasync = require('deasync')

var Traversal = function (node, opts) {
  if (!node) {
    throw new Error('Invalid Root Node')
  }
  var visited = []
  var waiting = [ { value: node, depth: 0, parent: -1, children: node.links.length } ]
  var current
  var order = opts.order || 'DFS'
  var skipDuplicates = opts.skipDuplicates || true
  var operation = opts.operation || null
  var action = opts.action || 'Pre'
  var dagService = opts.dagService
  var getLinkNodes = function () {
    var nodes = []
    if (current) {
      for (var i = 0; i < current.value.links.length; i++) {
        var link = current.value.links[ i ]
        if (link.node) {
          nodes.push({
            value: link.node, depth: (current.depth + 1),
            parent: visited.length, children: link.node.links.length
          })
        } else {
          if (dagService) {
            var done = false
            dagService.get(link.hash().toString('hex'), function (err, node) {
              if (err) {
                done = true
                throw new Error(err)
              }
              link.node = node
              nodes.push({
                value: link.node, depth: (current.depth + 1),
                parent: visited.length, children: link.node.links.length
              })
              done = true
            })
            deasync.loopWhile(function () {return !done })
          } else {
            throw new Error('Invalid DAG Service - Node missing from link')
          }
        }
      }
    }
    return nodes
  }
  var operatePost = function () {
    if (current.value.links.length === 0) {
      operation(current)
      if (current.parent == -1) {
        return
      }
      var parent = visited[ current.parent ]
      parent.children--;
      while (parent.children == 0) {
        operation(parent)
        if (parent.parent == -1) {
          return
        }
        parent = visited[ parent.parent ]
        parent.children--;
      }
    }
  }
  var visit = function () {
    if (order === 'DFS') {
      if (current) {
        visited.push(current)
      }
      current = waiting.shift()
      waiting = getLinkNodes().concat(waiting)
      if (skipDuplicates) {
        waiting = uniqueBy(waiting, function (obj) { return obj.value.key().toString('hex')})
      }
      if (operation && action == 'Post') {
        operatePost()
      }
      if (operation && action == 'Pre') {
        operation(current)
      }
    }
    if (order === 'BFS') {
      if (current) {
        visited.push(current)
      }
      current = waiting.shift()
      waiting = waiting.concat(getLinkNodes())
      waiting.sort(function (a, b) { return a.depth - b.depth})
      if (skipDuplicates) {
        waiting = uniqueBy(waiting, function (obj) { return obj.value.key().toString('hex')})
      }
    }
  }
  return {
    next: function () {
      if (waiting.length > 0) {
        visit()
        if (current && current.value) {
          return {value: current.value, done: false}
        } else {
          return { done: true }
        }
      } else {
        return { done: true }
      }
    },
    currentDepth: function () {
      if (current) {
        return current.depth
      } else {
        return 0
      }
    }
  }

}
module.exports = Traversal