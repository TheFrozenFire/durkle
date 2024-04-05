import { Poseidon, sha256 } from "@iden3/js-crypto";
import { assert } from "chai";

const F = Poseidon.F
const depth = 20

type ArrayLengthMutationKeys = 'splice' | 'push' | 'pop' | 'shift' | 'unshift' | number
type ArrayItems<T extends Array<any>> = T extends Array<infer TItems> ? TItems : never
export type FixedLengthArray<T extends any[]> =
  Pick<T, Exclude<keyof T, ArrayLengthMutationKeys>>
  & { [Symbol.iterator]: () => IterableIterator< ArrayItems<T> > }

type Leaf = bigint
type Node = FixedLengthArray<[bigint, bigint]>

// The hash combination function is `f(a,b) = (a+b,ab) mod p` where `p` is a large prime number.

function combine_leaves(a: Leaf, b: Leaf): Node {
  return [
    F.add(a, b),
    F.mul(a, b)
  ]
}

function combine_nodes(a: Node, b: Node): Node {
  return [
    F.add(a[0], b[0]),
    F.mul(a[1], b[1])
  ]
}

function combine_node_and_leaf(node: Node, leaf: Leaf): Node {
  return [
    F.add(node[0], leaf),
    F.mul(node[1], leaf)
  ]
}

let leaf = sha256(new Uint8Array(Buffer.from("nothing up my sleeve").buffer)).reduce((acc, val) => (acc << 8n) | BigInt(val), 0n) << 3n;
let leaves = new Array<Leaf>(2 ^ depth)

for(let i = 0; i < (2 ^ depth); i++) {
    leaf = Poseidon.hash([leaf])

    leaves.push(leaf)
}

assert.deepEqual(
    leaves.reduce(combine_node_and_leaf, [0n, 1n]),
    leaves.sort(() => Math.random() - 0.5).reduce(combine_node_and_leaf, [0n, 1n]),
    "The order of the leaves should not matter"
)

let message = Poseidon.hash([ (new Uint8Array(Buffer.from("nothing up my sleeve").buffer)).reduce((acc, val) => (acc << 8n) | BigInt(val), 0n) ])
let blinding = Poseidon.hash([F.random()])

console.log("message", message)

leaves[0] = message
leaves[1] = blinding

let blinded_node = combine_leaves(message, blinding)
let root_without_message = leaves.slice(2).reduce(combine_node_and_leaf, [0n, 1n])
let root = combine_nodes(blinded_node, root_without_message)
let root_with_blinding = combine_node_and_leaf(root_without_message, blinding)

console.log("root without message", root_without_message)
console.log("root", root)
console.log("root with blinding", root_with_blinding)
console.log("root with blinding and message", combine_node_and_leaf(root_with_blinding, message))

// Given the root with the blinding factor, and the message, is it possible to find the blinding factor?