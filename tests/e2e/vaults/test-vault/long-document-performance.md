# Sets, Relations, Functions

## Ch.1 Sets

**Definition 1.1 (Extensionality)**

: If A and B are sets, then $A = B$ iff every element of A is also an element of B, and vice versa.

Definition 1.5 (Subset)

~ If $\forall x(x \in A \rightarrow x \in B)$ , then we say that A is a subset of B, and write $A \subseteq B$.
~ If A is not a subset of B we write $A \not\subseteq B$.
~ If $A \subseteq B$ but $A \neq B$, we write $A \subsetneq B$ and say that A is a *proper subset* of B.

**Proposition 1.8**

: $A = B$ iff both $A \subseteq B$ and $B \subseteq A$.

**Definition 1.9 (Abbreviation)**

~ $(\forall x \in A) \phi$ abbreviates $\forall x (x \in A \rightarrow \phi)$.
~ Similarly, $(\exists x \in A) \phi$ abbreviates $\exists x (x \in A \land \phi)$

**Definition 1.10 (Power Set)**

~ The set consisting of all subsets of a set A is called the power set of A, written $\wp(A)$.
~ $\wp(A) = \{B : B \subseteq A\}$

**Definition 1.15 (Union)**

~ The union of two sets A and B, written A ∪ B, is the set of all things which are elements of A, B, or both.
~ $A \cup B = \{x : x ∈ A \lor x ∈ B \}$

**Definition 1.17 (Intersection)**

~ The intersection of two sets A and B, written $A \cap B$, is the set of all things which are elements of both A and B.
~ $A \cup B = \{x:x \in A \land x \in B\}$
~ Two sets are called *disjoint* if their intersection is empty

**Definition 1.19 (big cup)**

- If A is a set of sets, then $\bigcup A$ is the set of elements of elements of A:
- $\bigcup A$ = {x : x belongs to an element of A}, i.e., = {x : there is a $B \in A$ so that $x \in B$ }

**Definition 1.20 (big cap)**

- If A is a set of sets, then $\bigcap A$ is the set of objects which all elements of A have in common:
- $\bigcap A$ = {x : x belongs to every element of A}, i.e. = {x : for all $B \in A, x \in B$ }

**Definition 1.22 (Difference)**.

- The set difference $A \setminus B$ is the set of all elements of A which are not also elements of B, i.e., $$A \setminus B = \{x:x \in A \land x \notin B\}$$

**Definition 1.23 (Ordered pair)**
$\langle a,b \rangle = \{\{a\}, \{a,b\}\}$

**Definition 1.24 (Cartesian product)**

- Given sets A and B, their Cartesian product $A \times B$ is defined by $$A \times B = \{\langle x,y\rangle: x \in A \land y \in B\}$$

**Example**: $\{0, 1, 2\} \times \{a, b\} = \{\langle 0,a \rangle, \langle 0,b\rangle, \langle 1,a \rangle, \langle 1,b \rangle, \langle 2,a \rangle, \langle 2,b \rangle \}$

**Proposition 1.27**

 - If A has n elements and B has m elements, then $A \times B$  has $n \cdot m$ elements.

**Theorem 1.29 (Russell’s Paradox)**

- There is no set $R = \{x:x \notin x\}$

## Ch.2 Relations

**Definition 2.1 (Binary Relation)**

- A *binary relation on a set A* is a subset of $A^2$.
- If $R \subseteq A^2$ is a binary relation on A and $x,y \in A$, we sometimes write $Rxy$ or $xRy$ for $\langle x,y \rangle \in R$

### Properties of relations: SCRT

**Definition 2.3 (Reflexivity)**

- A relation $R \subseteq A^2$ is *reflexive* iff, $\forall x \in A(Rxx)$

**Definition 2.8 (Irreflexivity)**

- A relation $R \subseteq A^2$ is *irreflexive* iff, $\forall x \in A(\neg Rxx)$

**Definition 2.5 (Symmetry)**

- A relation $R \subseteq A^2$ is *symmetric* iff, whenever $Rxy$, then also $Ryx$

**Definition 2.6 (Anti-symmetry: Asymmetry except identity)**

- A relation $R \subseteq A^2$ is *anti-symmetry* iff, whenever both $Rxy$ and $Ryx$, then $x=y$

**Definition 2.9 (Asymmetry)**

- A relation $R \subseteq A^2$ is *asymmetry* iff, there is no $\langle x,y \rangle (x,y \in A)$ such that $Rxy \land Ryx$

> Notice that, a relation can be
> - both symmetry and anti-symmetry when for all pairs <x,y>, x = y
> - both asymmetry and anti-symmetry when for all pairs <x,y>, x $\neq$ y
> - Asymmetry entails anti-symmetry

**Definition 2.7 (Connectivity)**

- A relation $R \subseteq A^2$ is *connected* if for all $x,y \in A$, if $x \neq y$, then either $Rxy$ or $Ryx$

**Definition 2.4 (Transitivity)**

- A relation $R \subseteq A^2$ is *transitive* iff, whenever $Rxy$ and $Ryz$, then also $Rxz$

### Equivalence Relations

**Definition 2.10 (Equivalence relation)**

- A relation $R \subseteq A^2$ that is *reflexive, symmetric and transitive* is called an equivalence relation.
- Elements x and y are said to be R-equivalent if $Rxy$

**Definition 2.11 (Partition)**

- Let $R \subseteq A^2$ be an equivalence relation. For each $x \in A$, the equivalence class of x in A is the set $[x]_{R}= \{y \in A : Rxy\}$
- The quotient of A under R is $\frac{A}{R}= \{[x]_{R}:x \in A\}$

> ==Remark to 2.11==
>
> This is intended to define the "partition" of a set. Within each partition, all elements have R-equivalence. And no element outside the partition has R-equivalence with any element inside partition

**Proposition 2.12 (Equivalence means same partition)**

- If $R \subseteq A^2$ is an equivalence relation, then $\forall x, y \in A, Rxy$ iff $[x]_{R}=[y]_{R}$

>
> Left to right:
>
> Assume $Rxy$, $[x]_{R} = \{\alpha \in A : R_{x \alpha}\}$ and $[y]_{R} = \{\beta \in A: R_{y \beta}\}$, we need to show that $[x]_{R}=[y]_{R}$
> In order to show this, we need to show first $[x]_{R} \subseteq [y]_{R}$. To show that, we need to show that, for any $z \in A$, if $z \in [x]_{R}$ then $z \in [y]_{R}$
> If $z \in [x]_{R}$ then we have $Rxz$. Since we have $Ryx$ we have $Ryz$. Therefore, $z \in [y]_{R}$.
> Similarly, we have $[y]_{R} \subseteq [x]_{R}$. Therefore, $[x]_{R}=[y]_{R}$
>

> ==Remark of Proof==
>
> Left to right:
> What we want to prove is the equality of sets. The first set is the set that contains elements that bears R-equal relation with x. The second set is the set that contains elements that bears R-equal relation with y. Therefore we need to prove that, for any element that is R-equal with x, it is also R-equal with y, and vice versa. In order to do that, we need a new variable z. We need to prove that if $Rxz$ then $Ryz$, and vice versa. This is easy because we have $Rxy$ and R is an equal relationship. Therefore, we have $Ryz$ because $Ryx$ and $Rxz$. The proof also goes the other direction.
>
> Right to left:
> What we have is that, for any z, $Rxz$ iff. $Ryz$. Since R is an equal relationship, we have $Rzy = Ryz$. By transitivity we have $Rxy$.
> Another proof: Since R is an equal relationship we have $Ryy$. Therefore, $y \in [y]_R$. Since $[y]_{R}= [x]_{R}, y \in [x]_{R}$. Since $[x]_R$ is defined by the property $Rxz$ and here $y=z$, we have $Rxy$

### Orders

**Definition 2.14 (Preorder)**

- A relation which is both *reflexive* and *transitive* is called a *preorder*.

**Definition 2.15 (Partial order)**

- A preorder which is also *anti-symmetric* is called a *partial order*.

**Definition 2.16 (Linear order)**

- A partial order which is also connected is called a *total order* or *linear order*

**Definition 2.21 (Strict order)**

- A *strict order* is a relation which is irreflexive, asymmetric and transitive

**Definition 2.22 (Strict linear order)**

- A strict order that is also connected is called a *strict total/linear order*.

|                     | Reflexive | Transitive | Anti-symmetric        | Symmetric | Connected |
| ------------------- | --------- | ---------- | --------------------- | --------- | --------- |
| Preorder            | T         | T          | /                     | /         | /         |
| Partial order       | T         | T          | T                     | /         | /         |
| Linear order        | T         | T          | T                     | /         | T         |
| Strict order        | A         | T          | entailed by Asymmetry | A         | /         |
| Strict Linear order | A         | T          | entailed by Asymmetry | A         | T         |

**Definition 2.24**

- If R is a strict order on A, then $R^{+}= R \cup Id_{A}$ is a partial order. Moreover, if R is a strict linear order, then $R^{+}$ is a linear order ($Id_{A}$ is the relation that defined the identity on A)

> **Proof**
>
> For the convenience of notation, let's call $Id_{A}$ $I$
>
> Reflexivity:
> $\forall x \in A (I_{xx})$, thus $\forall x \in A(R^{+}_{xx})$
>
> Transitivity:
> Given $R^{+}_{xy}$ and $R^{+}_{yz}$, if x=y or y=z, obviously we have $R^{+}_{xz}$ by replacing them; if $x \neq y \land y \neq z$, then $\langle x,y \rangle \in R$ and $\langle y,z \rangle \in R$. Since R has transitivity, we have $R_{xz}$. Thus $R^{+}_{xz}$
>
> Anti-symmetric:
> Suppose it is not anti-symmetric, i.e. $R^{+}_{xy} \land R^{+}_{yx} \land x \neq y$. Since $x \neq y$, $\neg I_{xy} \lor \neg I_{yx}$. Thus $R_{xy} \land R_{yx}$. But R is asymmetric. Therefore the supposition is false. Thus it is anti-symmetric.
>
> Moreover clause: connectedness
> Since R is connected, then $\langle x,y \rangle \in R \lor \langle y,x \rangle \in R$. Obviously, this would also hold true for $R^{+}$.

**Proposition 2.25** If $R$ is a partial order on $A$, then $R- = R \setminus Id_{A}$ is a strict order. Moreover, if $R$ is a linear order, then $R−$ is a strict linear order.

> **Proof**
>
> Irreflexivity:
> We prove $R-$ is irreflexive by reductio.
> Assume $R-$ is not irreflexive, by definition $\exists x (x \in A \land R-_{xx})$. Then there would be an instance $a$ that makes this sentence true. Then we have $a \in A \land R-_{aa}$ But $\langle a, a \rangle \in Id_{A}$, which contradicts with $R- = R \setminus Id_{A}$. Therefore, $R-$ is irreflexive.
>
> Transitivity:
> To prove transitivity, by definition we need to show $(R-_{xy} \land R-_{yz}) \rightarrow R-_{xz}$ is true. We prove this by showing that the consequent follows from the antecedent.
> Assume the antecedent $R-_{xy} \land R-_{yz}$. Then we have $R_{xy} \land R_{yz}$, and thereby $R_{xz}$, due to the transitivity of $R$. Then we need to show that $\langle x,z \rangle \notin Id_{A}$. We prove this by reductio.
> Assume $\langle x,z \rangle$ in $Id_{A}$, then $x = z$. Then $Ryz = Ryx$. But $R$ is anti-symmetric and $x \neq y$. This follows that we cannot have both $Rxy$ and $Ryx$, contradiction. Therefore $\langle x,z \rangle$ is not in $Id_{A}$.
>
> Given $R_{xz}$ and $\langle x,z \rangle \notin Id_{A}$, we have $R-_{xz}$. Since the consequent follows from the antecedent, the conditional is true. Therefore $R-$ is Transitive
>
> Asymmetric:
> We probe $R-$ is asymmetric by reductio.
> Assume $R-$ is not asymmetric. By definition there is a pair $\langle a,b \rangle (a, b \in A)$ such that $R-_{ab} \land R-_{ba}$. We know $a \neq b$ because $\langle a,b \rangle \notin Id_{A}$. But since $\langle a, b \rangle \in R-$ and $R$ is anti-symmetric, we cannot have $R-_{ab} \land R-_{ba}$. Then the assumption is false. Therefore $R-$ is asymmetric.
>
> Moreover clause: Connectivity
> For any $\langle x,y \rangle \in R-$, $x \neq y$ because $\langle x,y \rangle \notin Id_{A}$. Also, $\langle x,y \rangle \in R$. Since R is connected, given $x \neq y$ we have $R_{xy} \lor R_{yx}$. Then obviously $R-_{xy} \lor R-_{yx}$. Therefore $R-$ is connected.

**Proposition 2.26** If $<$ is a strict linear order on $A$, then: $(\forall a,b \in A)((\forall x \in A) (x < a \leftrightarrow x < b) \rightarrow a = b).$

> **Proof**
>
> We prove by reductio. Assume $\forall x \in A(x < a \leftrightarrow x < b)$, and $a \neq b$
> Since R is connected, then either $a < b$ or $b < a$
> (i) $a < b$
> When $x = a$ we have $a<a$, but $<$ is irreflexive. contradiction.
> (ii) $b < a$
> When $x=b$ we have $b<b$, But $<$ is irreflexive. contradiction
> Since in all cases there is a contradiction, the assumption is false.

### Graphs

**Definition 2.27 (Directed Graph)** A directed graph $G=\langle V,E \rangle$ is a set of vertices`nodes` $V$ and a set of edges`relation between vertices, defined by ordered pairs` $E \subseteq V^{2}$

### Operations on Relations

**Definition 2.29.** Let R, S be relations, and A be any set.

- The *inverse* of R is $R^{-1} = \{\langle y,x \rangle : \langle x, y \rangle \in R\}$. `swapping x and y`
- The *relative product* of R and S is $(R | S) = \{\langle x, z \rangle : \exists y (Rxy \land S yz)\}$.
- The *restriction* of R to A is $R\upharpoonright_{A} = R \cap A^2$
- The *application* of R to A is $R[A] = \{y : (\exists x \in A)Rxy \}$

**Definition 2.31 (Transitive closure)**. Let $R \subseteq A^2$ be a binary relation.

- The transitive closure of $R$ is $R^+ = \bigcup_{0 < n \in \mathbb{N}} R^n$, where we recursively define $R^1 = R$ and $R^{n+1} = R^{n}| R$. `connecting heads and tails, operate it n times`
- The reflexive transitive closure of $R$ is $R^* = R^+ \cup \mathrm{Id}_A$.

## Ch. 3 Functions

**Definition 3.1 (Function)** A function $f:A \rightarrow B$ is a mapping of each element of A to an element of B.

- We call A the domain of f and B the codomain of f . The elements of A are called inputs or *arguments of f* , and the element of B that is paired with an argument x by f is called the *value of f* for argument x, written f(x).
- The range ran(f) of f is the subset of the codomain consisting of the values of f for some argument; ran(f) = {f(x) : x ∈ A}.

> Remark on definition 3.1: range is 值域 and codomain is 陪域

### Kinds of Functions

**Definition 3.8 (Surjective, range covers codomain).** A function $f : A \to B$ is *surjective* iff $B$ is also the range of $f$, i.e., for every $y \in B$ there is at least one $x \in A$ such that $f(x) = y$, or in symbols:

$(\forall y \in B)(\exists x \in A) f(x) = y.$

We call such a function a surjection from $A$ to $B$.

> Remark to 3.8: If you stipulate B to be ran(A), then f will always be surjective

**Definition 3.9 (Injective, no overlapping output)** A function $f: A \rightarrow B$ is *injective* iff for each $y \in B$ there is at most one $x \in A$ such that $f(x)=y$. We call such a function an injection from A to B.
If you want to show that f is an injection, you need to show that for any elements x and y of f ’s domain,

if $f (x) = f (y)$, then $x = y$.

**Definition 3.11 (Bijection, one to one mapping)**. A function f : A → B is *bijective* iff it is both *surjective* and *injective*. We call such a function a bijection from A to B (or between A and B)

### Functions as Relations

**Definition 3.12 (Graph of a function).** Let $f: A \to B$ be a function. The graph of $f$ is the relation $R_f \subseteq A \times B$ defined by $R_{f} = \{ \langle x,y \rangle : f(x) = y\}$.

**Implicit (extensionality of function)**. if ∀x f (x) = g (x), then f = g

**Proposition 3.13**. Let $R \subseteq A \times B$ be such that:

1. If $R_{xy}$ and $R_{xz}$ then $y=z$; and
2. for every $x \in A$ there is some $y \in B$ such that $\langle x,y \rangle \in R$

Then R is the graph of the function $f:A \rightarrow B$ defined by $f(x)=y$ iff $Rxy$

> **Proof**
>
> ? I don't think the textbook provided any rigorous proof

**Definition 3.14** Let $f: A \rightarrow B$ be a function with $C \subseteq A$.

- The restriction of $f$ to $C$ is the function $f \upharpoonright_{C}: C \rightarrow B$ is defined by $(f \upharpoonright_{C})(x) = f(x)$ for all $x \in C$. In other words,  $f \upharpoonright_{C}=\{\langle x,y \rangle \in R_{f}: x \in C\}$

- The application of $f$ to $C$ is $f[c] = \{f(x):x \in C\}$. We also call this the *image* of C under f

### Inverse of Functions

**Definition 3.15.** A function $g: B \rightarrow A$ is an inverse of a function $f: A \rightarrow B$ if $f(g(y))=x$ for all $x \in A$ and $y \in B$

If $f$ has an inverse $g$, then we often write $f^{-1}$ instead of $g$.

But when do a function has inversion?

**Proposition 3.16** If $f:A \rightarrow B$ is injective, then there is a left inverse $g:B \rightarrow A$ so that $g(f(x)) = x$ for all $x \in A$

> **Proof**
>
> We prove this by showing the consequent follows from the antecedent.
> Suppose $f:A \rightarrow B$ is injective. For $\forall y \in B$, we know that there exits at most one x such that $f(x)=y$. We analyze it case by case.
> (i) There is exactly one $x \in A$ such that $f(x)=y$. Then we can define $g(y) = x$
> (ii) There is no $x \in A$ such that $f(x)=y$. Then we can define $g(y)=a, a \in A$
> Given this, we have constructed a $g(y)$ for all $y \in B$. Since $x \in A$ and $a \in A$, we know $ran(g) \subseteq A$. Therefore, we have $g:B \rightarrow A$. And for any $x \in A$, there is always $f(x)=y$. Therefore, $g(f(x))=g(y)=x$

**Proposition 3.17** If $f:A \rightarrow B$ is surjective, then there is a right inverse $h:B \rightarrow A$ of f so that $f(h(y))=y$ for all $y \in B$

> **Proof**
>
>  We prove this by showing the consequent follows from the antecedent.
>  Suppose $f:A \rightarrow B$ is surjective, then for any $y \in B$ we have at least one $x \in A$ such that $f(x)=y$. We analyze it case by case.
>  (i) There is exactly one $x \in A$ such that $f(x)=y$. Then we can define $h(y)=x$ if there is exactly one $x \in A(f(x)=y)$
>  (ii) There are more than one $x \in A$ such that $f(x)=y$. We can construct a set $S=\{x \in A:f(x)=y\}$ and arbitrarily pick one element $e \in S$ then define $h(y)=e$ if there are more than one $x \in A(f(x)=y)$
>  Given this, we have constructed $h(y)$ for all $y \in B$. Since $x,e \in A$, we have $h:A \rightarrow B$. And obviously $f(h(y))=y, y \in B$ holds in all cases.

**Proposition 3.18** If $f:A \rightarrow B$ is bijective, there is a function $f^{-1}:B \rightarrow A$ so that for all $x \in A, f^{-1}(f(x))=x$ and for all $y \in B, f(f^{-1}(y))=y$

> **Proof**
>
> We prove this by showing the consequent follows from the antecedent.
> Suppose $f:A \rightarrow B$ is bijective. We know that $\forall y \in B$, there is exactly one $x \in A$ such that $f(x)=y$.  Then we define the output of $f^{-1}(y)=x$ such that $f(x)=y$.
>
> Also, for any $y \in B$,
>
> - Since there is at most one $x$ such that $f(x)=y$, uniqueness requirement is satisfied.
> - Since there is at least one $x$ such that $f(x)=y$, totality requirement is satisfied
>
> Therefore, $f^{-1}$ is a well-defined function.
>
   Since $x \in A (f(x)=y)$, we  have $f^{-1}:B \rightarrow A$
>
> We first show for all $x \in A, f^{-1}(f(x))=x$.
> Let $k = f^{-1}(f(x))$. By definition of $f^{-1}$, $f(k)=f(x)$. Since $f$ is injective, $k=x$. Therefore, $f^{-1}(f(x)) = x$
>
> Then we show for all $y \in B, f(f^{-1}(y))=y$.
> Let $m=f(n), n=f^{-1}(y)$. By definition of $f^{-1}$, $f(n)=y$. $f(n)$ cannot have two different outputs, thus $m=y$.  Therefore, $f(f^{-1}(y))=y$

**Proposition 3.19**. Show that if $f:A \rightarrow B$ has a left inverse $g$ and a right inverse $h$, then $h = g$.

Remark: the important info here is "there is such left inverse and right inverse"

> **Proof**
>
> In order to show that $h=g$, we show that, for any arbitrary $k \in A$, $h(k)=g(k)$
>
> If $f: A \rightarrow B$ has a left inverse $g$, then there is a $g:B \rightarrow A$ such that $g(f(x)) = x$ for all $x \in A$.
>
> If $f: A \rightarrow B$ has a right inverse $h$, then there is a $h:B \rightarrow A$ such that $f(h(y)) = y$ for all $y \in B$.
>
> Now we need to show $h=g$. We prove this by reductio. Assume $\exists n \in B$ such that $g(n) \neq h(n)$. We have $f(h(n))=n$, thus $g(f(h(n)))=h(n)$. Since $f(h(n))=n$, $g(f(h(n)))=g(n)$. Now we have $g(n) = h(n)$, contradiction. Therefore $h=g$

### Composition of Function

**Definition 3.21 (Composition)** Let $f:A \rightarrow B$ and $g:B \rightarrow C$ be functions. The composition of f with g is $g \circ f: A \rightarrow C$, where $(g \circ f )(x) = g (f(x))$.

### Partial Functions

**Definition 3.23**. A *partial function* $f : A \rightharpoonup B$ is a mapping which assigns to every element of $A$ at most one element of $B$. If $f$ assigns an element of $B$ to $x \in A$, we say $f(x)$ is defined, and otherwise undefined. If $f(x)$ is defined, we write $f (x) \downarrow$, otherwise $f (x) \uparrow$. The domain of a partial function f is the subset of A where it is defined, i.e., $dom(f) = \{x ∈ A : f (x) \downarrow\}$.

**Definition 3.26 (Graph of a partial function)**. Let $f : A \rightharpoonup B$ be a partial function. The graph of f is the relation $R_{f} \subseteq A \times B$ defined by $R_{f} = \{⟨x, y⟩ : f (x) = y \}$.

**Proposition 3.27**. Suppose $R \subseteq A \times B$ has the property that whenever $R_{xy}$ and $R_{xy}′$ then $y = y′$ . Then $R$ is the graph of the partial function $f:X \rightharpoonup Y$ defined by: if there is a $y$ such that $R_{xy}$, then $f(x) = y$, otherwise $f(x) \uparrow$. If $R$ is also serial, i.e., for each $x \in X$ there is a $y \in Y$ such that $R_{xy}$, then $f$ is total.

> **Proof**
>
>

## Ch.4 The Size of Sets

**Definition 4.1 (Enumeration, informally)**. Informally, an enumeration of a set $A$ is a list (*possibly infinite*) of elements of $A$ such that every element of $A$ appears on the list at some *finite* position. If $A$ has an enumeration, then $A$ is said to be *countable*.

- enumeration must have a beginning
- order and redundancy matters
- all position must be finite

**Proposition 4.2**. If A has an enumeration, it has an enumeration without repetitions.

> **Proof**
>
> For any enumeration $E$ that lists $x_{1}, x_{2},  ..., x_{n}$ , we can construct another enumeration $E'$ by putting a distinct $x_{n}$ into $E'$

**Definition 4.3 (Enumeration, formally)**. An enumeration of a set $A \neq \emptyset$ is any surjective function $f : Z^{+} \rightarrow A$.

**Definition 4.4 (Countability)** A set $A$ is *countable* iff it is empty or has an enumeration.

**Proposition 4.8**. There is a surjection $f: \mathbb{Z}^+ \rightarrow A$ iff there is a surjection $g: \mathbb{N}→A$.

> **Proof**
>
> Given $f: \mathbb{Z}^+ \rightarrow A$ we can define $g(n)=f(n+1)$ for all $n \in \mathbb{N}$; Similarly we can define $f(n)=g(n-1)$ for all $n \in \mathbb{Z^+}$

**Corollary 4.9**. A set A is countable iff it is empty or there is a surjective function $f: \mathbb{N} \rightarrow A$

> **Proof**: Given 4.3 and 4.8, this is obvious

**Proposition 4.10** If $f:\mathbb{Z^+} \rightarrow A$ is surjective (i.e., an enumeration of $A$), there is a bijection $g:Z \rightarrow A$ where $Z$ is either $\mathbb{Z^+}$ or $\{1, ..., n\}$ for some $n \in Z^+$.

> **Proof**: (Not rigorous)
>
> We construct $g$ recursively: $g(1)=f(1)$; if $g(i)$ is already defined, then $g(i+1)$ is the first value in $f(1), f(2), ...$ that is not in $g(1), g(2), ... , g(i)$ if there is one. If $A$ has $n$ elements, we would define $g:\{1,2,...,n\} \rightarrow A$; If $A$ has infinite elements, then $g:\mathbb{Z^{+}} \rightarrow A$
> g is surjective because f is surjective; g is injective because there is no repetition. Therefore g is bijective.

**Corollary 4.11** A set $A$ is countable iff it is empty or there is a bijection $f : N → A$ where either $N = \mathbb{N}$ or $N = \{0, . . . ,n\}$ for some $n \in \mathbb{N}$

> **Proof**: Given 4.10, we can prove this in the same way we prove 4.8

### Cantor's Zig-Zag Method

**Proposition 4.12**: $\mathbb{N} \times \mathbb{N}$ is countable

Mapping Cantor’s zig-zag array:

|     | 0   | 1   | 2   | ... |
| --- | --- | --- | --- | --- |
| 0   | 0   | 1   | 3   | ... |
| 1   | 2   | 4   | ... | ... |
| 2   | 5   | ... | ... | ... |
| ... | ... | ... | ... | ... |

to:

|     | 0                     | 1                     | 2                     | ... |     |
| --- | --------------------- | --------------------- | --------------------- | --- | --- |
| 0   | $\langle 0,0 \rangle$ | $\langle 0,1 \rangle$ | $\langle 0,2 \rangle$ | ... |     |
| 1   | $\langle 1,0 \rangle$ | $\langle 1,1 \rangle$ | $\langle 1,2 \rangle$ | ... |     |
| 2   | $\langle 2,0 \rangle$ | $\langle 2,1 \rangle$ | $\langle 2,2 \rangle$ | ... |     |
| ... | ...                   | ...                   | ...                   | ... |     |

> **Proof**(informal)
>
>  Let $f: \mathbb{N} \rightarrow \mathbb{N} \times \mathbb{N}$ take each $k \in \mathbb{N}$ to the tuple $\langle n,m \rangle \in \mathbb{N} \times \mathbb{N}$ such that $k$ is the value of the $n$th row and $m$th column in Cantor’s zig-zag array.

**Proposition 4.13**. $\mathbb{N}^{n}$ is countable, for every $n \in N$

>  **Proof**(informal)
>
>  Given 4.12, we can prove this by recursion. $\mathbb{N}^{n+1}$ is countable because we can map $\mathbb{N}$ to $(\mathbb{N}^{n} \times \mathbb{N})$ using cantor's zig-zag array.

We can formalize the cantor's array as $g(m,n)=\frac{(n+m+1)(n+m)}{2}+n$.

> **Remark**
>
> The intuition behind this equation is that, given n row and m column, we want to find out which number is in that cell. We can understand the zig-zag as a kind of iteration. The 1st iteration fill 1 cell. The 2nd round fills 2 cells. Therefore, after n rounds, there are $1+2+...+n$ cells filled. Now which round is <m,n> in? We can see the table as a coordinate system and we know the gradient of "round line" is -1. Then it is easy to know that <m,n> is in the middle of m+n+1 round. Then we know that all the $1+2+...+m+n$ are all filled, i.e. $\frac{(n+m)(n+m+1)}{2}$ cells are already filled. Now we still need to know how many cells have been filled in round $m+n+1$. This is easy because we can just align all the cells vertically. Therefore we know that there are $n$ cells

### Paring Functions and Codes

**Definition 4.14 (Pairing function)**. A function $f: A \times B \rightarrow \mathbb{N}$ is an arithmetical *pairing function* if $f$ is injective. We also say that $f$ encodes $A \times B$, and that $f(x,y)$ is the code for $\langle x, y \rangle$.

### Uncountable Sets

$B^{\omega}$ represents the set of all possible infinite strings (or sequences) where each character is either a 0 or a 1. Every position in the sequence is filled with a 0 or 1, and there is no endpoint—the sequence continues indefinitely.

**Theorem 4.17**. $B^\omega$ is uncountable

> **Proof**
>
> We prove this by reductio. Assume there is list $s_1,s_2,...$ of all elements in $B^\omega$. We can define $s_{i}(j)$ as the $j^{th}$  digit of $s_{i}$. Then we may list elements in $B^\omega$ in the following way:

|       | 1              | 2              | 3              | 4              | ...     |
| ----- | -------------- | -------------- | -------------- | -------------- | ------- |
| $s_1$ | **$s_{1}(1)$** | $s_{1}(2)$     | $s_{1}(3)$     | $s_{1}(4)$     | ...     |
| $s_2$ | $s_{2}(1)$     | **$s_{2}(2)$** | $s_{2}(3)$     | $s_{2}(4)$     | ...     |
| $s_3$ | $s_{3}(1)$     | $s_{3}(2)$     | **$s_{3}(3)$** | $s_{3}(4)$     | ...     |
| $s_4$ | $s_{4}(1)$     | $s_{4}(2)$     | $s_{4}(3)$     | **$s_{4}(4)$** | ...     |
| ...   | ...            | ...            | ...            | ...            | **...** |

> Now we construct a sequence of $s' \in A$ but not in our diagram. We can specify $s'(n)$ for all $n \in \mathbb{Z^{+}}$:
 $$
 s'(n) =
 \begin{cases}
 1 & \text{if } s_n(n) = 0, \\
 0 & \text{if } s_n(n) = 1.
 \end{cases}
 $$
> Now $s'$ is not in the list $s_{1},s_2,...$. We prove this by reductio: if there is a sequence $s_{k}=s'$, then $s_{k}(x)=s'(x)$ for all $x \in \mathbb{N}$. But that's not possible because $s_{k}(k) \neq s'(k)$ while $k \in \mathbb{N}$. Contradiction.

**Theorem 4.18**. $\wp (Z^+)$ is not countable.

> **Proof**
>
> Suppose there is a list of subsets $\mathbb{Z^+}$. We can always define a $Z'=\{n \in \mathbb{Z^{+}}: n \notin Z_{n}\}$.

### Reduction

**Proposition (Reduction)**: For a surjective $f: A \rightarrow B$, if $A$ is countable, then $B$ is countable

> **Remark**
>
> Notice that there can be a bijective $f: B^{\omega}\rightarrow \wp (Z^+)$. We can define $f(s)=\{n:s(n)=1\}$. In order to deny $\wp(\mathbb{Z^+})$ is countable, we need to use modus tollens: if $\wp(Z^+)$ is countable, then $B^\omega$ is countable. Since the latter is not, then the former is not. The idea is that, if a function $f$ is surjective, and the codomain is enumerable, then $f(x)$ is also enumerable.

### Equinumerosity

**Definition 4.19** A is equinumerous with B, written $A \approx B$ (or $|A|=|B|$ ), iff there is a bijection $f:A \rightarrow B$.

**Proposition 4.20** Equinumerosity is an equivalence relation

> **Proof**
>
> We need to show that equinumerosity is reflexive, transitive and symmetry.
> Reflexivity: $f:A \rightarrow A$ where $f(x)=x$ for $x \in A$.
> Symmetry: If $f:A \rightarrow B$ and $f$ is bijective, then we have the inverse function $f^{-1}:B \rightarrow A$
> Transitivity: If $f:A \rightarrow B$ and $g: B \rightarrow C$, we can define $h:A \rightarrow C$ such that $h(x)=g(f(x))$ for $x \in A$

**Proposition 4.21** If $A \approx B$, then $A$ is countable iff B is.

> **Proof**
>
> If A is countable, then $A = \emptyset$ or there is a surjective $f: \mathbb{Z^{+}} \rightarrow A$. Since $A \approx B$, we know there is a bijective $h: A \rightarrow B$
> If $A = \emptyset$ then $B = \emptyset$, making $B$ countable.
> If $A \neq \emptyset$, we can define $j: \mathbb{Z^+}$ such that $j(x)=h(f(x))$ for $x \in \mathbb{Z^+}$. Since we have a $j: \mathbb{Z^{+}}\rightarrow B$. Obviously $j$ is surjective. Therefore $B$ is countable.
> Therefore, the left direction is true. Similarly, the right direction is true.

### Sets of Different Sizes, and Cantor's Theorem

**Definition 4.22** A is *no larger than* B, written $A \preceq B$, iff there is an injection $f:A \rightarrow B$.

**Definition 4.23** A is *smaller than* B, written $A \prec B$, iff there is an injection $f: A \rightarrow B$ but no bijection $g:A \rightarrow B$, i.e., $A \preceq B$ and $A \not\approx  B$

**Theorem 4.24 (Cantor's Theorem)** $A \prec \wp(A),$ for any set A

> **Proof**
>
> We need to show that there is an injective function $f: A \rightarrow \wp(A)$ but there's no bijective $h: A \rightarrow \wp(A)$.
> We can construct $f(x)=\{x\}$ for $x \in A$. This is an injection because if $x \neq y$, then $\{x\} \neq \{y\}$.
> Now we need to show that there cannot be a surjective $g$. We use cantor's diagonal method to show that there is always a way to find something in the codomain that cannot be found in any arbitrary mapping from the domain to the codomain.
> Suppose there is a function $g:A \rightarrow \wp(A).$ We construct something that is $\in ran(g)$ but $\notin \wp(A)$. We construct $A'=\{x \in A: x \notin g(x)\}$. Now we prove that $A' \notin ran(g)$. We prove this by reductio.

### Notion of Size, and Schröder-Bernstein

**Theorem 4.25 (Schröder-Bernstein)**. If $A \preceq B$ and $B \preceq A$, then
$A \approx B$.

# First-order logic

## Ch.5 Introduction to First-order Logic

### Syntax

- non-logical symbols: constants, predicates, variables
- logical symbols: $\neg, \land, \lor, \exists, \forall$,...

Definition (Terms)

: every constant symbols and variables are terms

### Formulas

**Remark**: Formula allows free variables. Formula that has no free variables is a sentence

**Definition 5.1 (Inductive Definition of Formulas)**. The set of *formulas* is defined as follows:

1. $P (a)$ and $P(v_i)$ are formulas ($i \in N$).
2. If $A$ is any formula, then $\neg A$ is formula.
3. If $A$ and $B$ are any formulas, then $(A \land B)$ is a formula.
4. If $A$ is a formula and $x$ is a variable, then $\exists x A$ is a formula.
5. Nothing else is a formula.

There could be other ways. This is just an example.

### Satisfaction

**Definition (structure)**

: M is a structure iff

1. $|M|$ is the domain of $M$, which is a non-empty set;
2. For any name $a$, $a$ picks out $a^{M}$ in $M$
3. For any predicate $P$, $P^{M}$ such that $P^{M} \subseteq M$

Definition (validity)

: A sentence A is valid iff A satisfies all structures

Definition (entailment, semantic)

: $\Gamma$ entails $A$, or $\Gamma \vDash A$, means that all structures that satisfies $\Gamma$ also satisfies $A$

Definition (derivation, syntactic)

: ?

**Definition (unquantified formula satisfies a structure)**

: “A is satisfied in M” (in symbols: $M \vDash A$) for sentences A and structures M

**Definition (Satisfaction without quantifiers)**

1. $P (a)$ is satisfied in $M$ iff $a^M \in  P^M$ .
2. $\neg A$ is satisfied in $M$ iff $A$ is not satisfied in $M$.
3. $(A \land B)$ is satisfied in $M$ iff $A$ is satisfied in $M$, and $B$ is

satisfied in $M$ as well.

Satisfaction with quantifiers:  we introduce **variable assignments**.

Definition (quantified formula satisfies a structure)

: “A is satisfied in M, s” (in symbols: $M,s \vDash A$) for sentences $A$, structures $M$ and function $s:\{x:x=v_{i}\} \rightarrow |M|$

Definition (specify assignment)

: If $s(v_{i})=m$, then we we write $s$ as $s[m/v_i]$

**Definition (Satisfaction with quantifiers)**

: A variable assignment is simply a function $s$ that maps variables to elements of $|M|$

1. $M,s \vDash P (a)$ iff $a^{M}\in P^{M}$
2. $M,s \vDash P (v_{i})$ iff $s(v_i) \in P^{M}$ .
3. $M,s \vDash \neg A$ iff not $M,s \vDash A$.
4. $M,s \vDash (A \land B)$ iff $M,s \vDash A$ and $M,s \vDash B$.
5. $M,s \vDash \exists v_{i}A$ iff $M,s [m/v_{i}] \vDash A$ for some $m \in |M|$.

### Sentences

Sentences: making sure all variables are bounded

6. If $A$ is atomic, all occurrences of $x$ in it are free (that is, the occurrence of $x$ in $P (x)$ is free).
7. If $A$ is of the form $\neg B$, then an occurrence of $x$ in $\neg B$ is free iff the corresponding occurrence of $x$ is free in $B$ (that is, the free occurrences of variables in B are exactly the corresponding occurrences in $\neg B$).
8. If $A$ is of the form $(B \land C)$, then an occurrence of $x$ in $(B \land C)$ is free iff the corresponding occurrence of $x$ is free in $B$ or in $C$ .
9. If $A$ is of the form $\exists x B$, then no occurrence of $x$ in $A$ is free; if it is of the form $\exists y B$ where $y$ is a different variable than $x$, then an occurrence of $x$ in $\exists y B$ is free iff the corresponding occurrence of $x$ is free in $B$.

### Semantic Notions

- A sentence is valid, $\vDash A$, if every structure satisfies it.
- It is entailed by a set of sentences, $\Gamma \vDash A$, if every structure that satisfies all the sentences in $\Gamma$ also satisfies $A$.
- And a set of sentences is satisfiable if some structure satisfies all sentences in it at the same time.

### Substitution

**Remark**: To allow the derivation from $\forall xPx$ to $Pa$

### Models and Theories

Definition (Models)

: Given a set of sentences $\Gamma$, a structure $M$ that satisfies them is called a model of $\Gamma$

**Axiomatic method**: Describing a collection of structures by a set of sentences, the axioms of a theory

The limit of first-order languages are consequences of the compactness and Lowenheim-Skolem theorems.

### Soundness and Completeness

- If $\Gamma \vdash A$ then $\Gamma \vDash A$, the deductive system is *sound*
- If $\Gamma \vDash A$ then $\Gamma \vdash A$, the deductive system is *complete*
- If $\Gamma \vdash A$ but not $\Gamma \vDash A$, the deductive system is *too strong*
- If $\Gamma \vDash A$ but not $\Gamma \vdash A$, the deductive system is *too weak*

## Ch.6 Syntax of First-order Logic

### 6.2 First-order Languages

Expressions of first-order logic are built up from:

1. Non-logical symbols: *variables*, *constant symbols*(individual objects), *predict symbols*(properties and relations) and sometimes *function symbols*(mappings)
	- Countably infinite set of $n$-place predicate symbols for each $n>0: A_{0}^{n}, A_{1}^{n}, A_{2}^{n},\dots$
	- Countably infinite set of constant symbols: $c_{0},c_{1},c_{3},\dots$
	- Countably infinite set of $n$-place function symbols for each $n>0: f_{0}^{n}, f_{1}^{n}, f_{2}^{n},\dots$
2. Logical symbols: connectives, quantifiers
	- Logical connectives: $\neg, \land, \lor, \rightarrow, \forall, \exists$
	- Falsity: $\bot$
	- Identify: $=$
	- Countably infinite set of variables: $v_{0},v_{1}, v_{2}\dots$
3. Punctuation symbols:
	- Comma: $,$
	- Parenthesis: $(,)$

> **Remark**
>
> Non-logical symbols depend on the particular structure; Logical symbols are fixed by first-order logic. Therefore, variables are logical symbols.
>
> Things like variables are infinite because some proofs needs there always be fresh symbols. It is countable because being countable is enough.

### 6.3 Terms and Formulas

Definition 6.4 (Terms)

: The set of terms $Trm(\mathscr{L})$ of $\mathscr{L}$ is defined inductively by:

1. Every *variable* is a term
2. Every *constant symbol* of $\mathscr{L}$ is a term (This is actually redundant if we allow $n=0$ when we define functions, since constants would then just be zero-place function)
3. If $f$ is an $n$-place *function symbol* and $t_{1}, \dots , t_{n}$ are terms, then $f(t_{1},\dots ,t_{n})$ is a term
4. Nothing else is a term

Definition 6.4.1 (Closed Term)

: A term containing no variables is a *closed term*

**Definition 6.5 (Formulas)**

: The set of formulas $Frm(\mathscr{L})$ of the language $\mathscr{L}$ is defined inductively by:

1. **Contradiction**: $\bot$ is an *atomic formula*
2. **Predication**: If $R$ is an $n$-place predicate symbol of $\mathscr{L}$, and $t_{1},...,t_{n}$ are terms of $\mathscr{L}$, then $R(t_{1},...,t_{n})$ is an *atomic formula*
3. **Identity**: If $t_{1},t_{2}$ are terms of $\mathscr{L}$, then $t_{1}=t_{2}$ is an *atomic formula*
4. **Negation**: If $A$ is a formula then $\neg A$ is a formula
5. **Operation**: If $A$ and $B$ are formulas then $(A * B)$ where $*=\land , \lor , \rightarrow$ is a formula
6. **Quantification**: If $A$ is a formula and $x$ is a variable, then $\forall x A$ and $\exists x A$ are formulas
7. Nothing else is a formula

Definition 6.6 (Conventional Symbols)

: Formulas constructed using the defined operators are to be understood as follows

1. $\top$ abbreviates $\neg \bot$
2. $A \leftrightarrow B$ abbreviates $(A \rightarrow B) \land (B \rightarrow A)$

Definition 6.7 (Syntactical Identify)

: The symbol $\equiv$ expresses syntactic identify between strings of symbols, i. e. $A \equiv B$ iff they are the same strings of symbols of the same length and which contain the same symbol in each place

Lemma 6.8 (Principle of induction on terms)

: Let $\mathscr{L}$ be a first order language. If some property $P$ holds in all of the following cases, then $P(t)$ for every $t \in Trm(\mathscr{L})$

1. $P(v)$ for every variable $v$
2. $P(a)$ for every constant symbol $a$ of $\mathscr{L}$
3. If $t_{1},\dots ,t_{n} \in Trm(\mathscr{L})$, $f$ is an $n$-place function symbol of $\mathscr{L}$, and $P(t_1),\dots ,P(t_{n})$, then $P(f(t_{1},\dots ,t_{n}))$

Lemma 6.9 (Principle of induction on formulas)

: Let $\mathscr{L}$ be a first order language. If for some property $P$

1. All atomic formulas has $P$
2. Assume $A$ has $P$, $\neg A$ also has $P$
3. Assume $A$ and $B$ has $P$, $(A * B),*=\land, \lor, \rightarrow$ also has $P$
4. Assume $A$ has $P$, $*xA, *=\forall, \exists$ also has $P$

then $P$ holds for all formulas $A \in Frm(\mathscr{L})$

### 6.4 Unique Readability

The way we defined formulas guarantees that every formula has a unique reading

**Lemma 6.10.1 (Balance parenthesis in terms)**: The number of left and right parenthesis in a term $t$ are equal

> To prove this, we need to show this holds for the base cases and the new formulas. The base cases include variables and constant symbols. The new formulas include function symbols.
>
>  Let $l(t)$ and $r(t)$ similarly the number of left and right parentheses in a term $t$.
> First we check the base cases. Recall the definition of variables $v_{n}, n \in \mathbb{N}$ and the definition of constants $c_{n},n \in \mathbb{N}$. Since there's no parentheses in variables and constant, $l(t)=r(t)$.
> Then we assume $l(t_{n})=r(t_{n})$ holds for $t_{1},\dots ,t_{n}$, we show that the number of left and right parentheses in the term $f(t_{1},\dots ,t_{n})$ are equal. $l=1+l(t_{1})+\dots +l(t_{n})$, $r=1+r(t_{1})+\dots +r(t_{n})$. Since $\sum\limits_{i=0}^{n}{r(t_{i})}=\sum\limits_{i=0}^{n}{r(t_{i})},l=r$.
> Therefore, Lemma 6.10.1 is true

**Lemma 6.10 (Balance parenthesis in formulas)**: The number of left and right parenthesis in a formula $A$ are equal

> **Proof**
>
> To prove this, we use the principle of induction on formulas. We need to show:
>
> 1. This is true for all atomic formulas
> 2. This is true whenever we construct a new formula
>
> Let $l(A)$ be the number of left parentheses, and $r(A)$ the number of right parentheses in $A$, and $l(t)$ and $r(t)$ similarly the number of left and right parentheses in a term $t$. Let's first check the base cases
>
> 1. $A \equiv \bot$: $A$ has 0 left and 0 right parentheses
> 2. $A \equiv R(t_{1}, \dots, t_{n})$: $l(A)=1+l(t_{1})+\dots +l(t_{n})=1+r(t_{1})+\dots +r(t_{n})$. Given Lemma 6.10.1, we know that $l(A)=r(A)$
> 3. $A \equiv t_{1}=t_{2}$: the proof is similar to (2)
>
> Now we have shown the base cases. Next, we assume that the formulas used has $l(A)=r(B)$ and see if this still holds for the new formula generated:
>
> 4. $A \equiv \neg B$ and assume $l(B)=r(B)$: We have $l(A)=l(B)$ and $r(A)=r(B)$. Therefore $l(A)=r(A)$
> 5. $A \equiv (B*C)$ where $*=\land, \lor, \rightarrow$, and assumption $l(B)=r(B),l(C)=r(C)$: We have $l(A)=l(B)+l(c)+1$ and $r(A)=r(B)+r(c)+1$. Therefore, $l(A)=r(A)$.
> 6. $A \equiv *xB$ where $*=\exists, \forall$: Similar to 1
>
> Given this, we have shown that all formula has the property of having the same number of left and right parenthesis

Definition (Proper prefix)

: A string of symbols $B$ is a proper prefix of a string of symbols $A$ if concatenating $B$ and a non-empty string of symbols yields $A$

**Lemma 6.12 (Formula's proper prefix is not a formula)**: Let $A$ be a formula. If B is a proper prefix of $A$, then $B$ is not a formula

> **Proof**
> ?

**Proposition 6.13 (Unique atomic formula expression)**: If $A$ is an atomic formula, then it satisfies one, and only one of the following conditions:

1. $A \equiv \bot$
2. $A \equiv R(t_{1},\dots ,t_{n})$ where $R$ is an $n$-place predicate symbol, $t_{1},\dots ,t_{n}$ are terms, and each of $R, t_{1},\dots ,t_{n}$ is uniquely determined.
3. $A \equiv t_{1} \equiv t_{2}$ where $t_{1}$ and $t_{2}$ are uniquely determined terms.

> **Proof**
>
> First we prove that there cannot be a formula that satisfies both 1 and 2, 1 and 3 and 2 and three. Then we prove that there cannot be two different formulas that satisfies 1 or 2 or 3.

**Proposition 6.14 (Unique Readability)**: Every formula satisfies one, and only one of the following conditions

1. $A$ is atomic
2. $A$ is of the form $\neg B$
3. $A$ is of the form $(B*C), *=\land, \lor, \rightarrow$
4. $A$ is of the form $*xB, *=\forall, \exists$

Moreover, in each case, $B$ or $B$ and $C$ are uniquely determined. This means that, e.g. there are no different pairs $B,C$ and $B',C'$ so that $A$ is both of the form $(B \rightarrow C)$ and $(B' \rightarrow C')$

> **Proof**
>
> The only non-trivial proof here is to show that if $(B*C)\equiv(B'*'C')$, then $B \equiv B',C \equiv C', * \equiv *'$.

### 6.5 Main operator of a Formula

Definition 6.15 (Main operator)

: The main operator of a formula $A$ is defined as follows:

1. $A$ is atomic: $A$ has no main operator
2. $A \equiv \neg B$: the main operator of $A$ is $\neg$
3. $A \equiv (B * C), *=\land, \lor, \rightarrow$: the main operator of $A$ is $*$
4. $A \equiv *xB, *=\exists, \forall$: the main operator of $A$ is $*$

### 6.6 Subformulas

Definition 6.16 (Immediate Subformula)

: If $A$ is a formula, the *immediate subformula* of A are defined inductively as follows:

1. Atomic formulas have no immediate subformulas
2. $A \equiv \neg B$: The only immediate subformula of $A$ is $B$
3. $A \equiv (B * C)$: The immediate subformulas of $A$ are $B$ and $C$
4. $A \equiv *xB$: The immediate subformula of $A$ is $B$

Definition 6.17 (Proper subformula)

: If $A$ is a formula, the *proper subformula* of A are defined inductively as follows:

1. Atomic formulas have no proper subformulas
2. $A \equiv \neg B$: The only proper subformula of $A$ are $B$ and all proper subformulas of $B$
3. $A \equiv (B * C)$: The proper subformulas of $A$ are $B$ and $C$ and all their proper subformulas
4. $A \equiv *xB$: The proper subformula of $A$ is $B$ and all proper subformulas

Definition 6.18 (Subformula)

: The subformula of $A$ are $A$ itself and all its proper subformulas.

**Proposition 6.19 (Transitivity of subformula)**: Suppose $B$ is a subformula of $A$ and $C$ is a subformula of $B$. Then $C$ is a subformula of $A$. In other words, the subformula relation is transitive.

**Proposition 6.20 (Amount of subformulas)**: Suppose $A$ is a formula with $n$ connectives and quantifiers. Then $A$ has at most $2n+1$ subformulas.

### 6.7 Formation Sequences

Definition 6.21 (Strings)

: Suppose $\mathscr{L}$ is a first-order language. An $\mathscr{L}$-string is a finite sequence of symbols of $\mathscr{L}$. Where the language $\mathscr{L}$ is clearly fixed by the context, we will often refer to a $\mathscr{L}$-string as a string.

Definition 6.23 (Formation sequence for terms)

: A finite sequence of $\mathscr{L}$-string $\langle t_{0},\dots ,t_{n} \rangle$ is a formation sequence for a term $t$ if

(i) $t \equiv t_{n}$, and
(ii) for all $i \le n$, either
	(a) $t_{i}$ is a variable or a constant symbol, or
	(b) $\mathscr{L}$ contains a $k$-ary function symbol $f$ and there exist $m_{0},\dots ,m_{k}<i$ such that $t_{i}\equiv f(t_{m_{0}},\dots ,t_{m_{k}})$

Definition 6.25 (Formation sequences for formulas)

: A finite sequence of $\mathscr{L}$-strings $\langle A_{0},\dots ,A_{n}\rangle$ is a formation sequence for $A$ if

(i) $A \equiv A_{n}$ and
(ii) for all $i \le n$, either
	(a) $A_{i}$ is an atomic formula, or
	(b) there exit $j, k<i$ and a variable $x$ such that one of the following holds:

		1. $A_{i} \equiv \neg A_{j}$
		2. $A_{i} \equiv (A_{j}*A_{k}), *=\land, \lor, \rightarrow$
		3. $A_{i} \equiv *xA_{j},*=\exists, \forall$

**Proposition 6.27 (All formulas have formation sequence)**: Every formula $A$ in $Frm(\mathscr{L})$ has a formation sequence

> **Proof**
>
> To show this, we need to show that
>
> (i) all atomic formulas have a formation sequence, and
> (ii) Assume all formulas used in the induction has a formation sequence, we need to show the newly generated formula also have a formation sequence.
>
> (i) Suppose $A$ is atomic. Then the sequence $\langle A \rangle$ is a formation sequence for $A$.
> (ii) Now suppose that $B$ and $C$ have formation sequences $\langle B_{0},\dots ,B_{n} \rangle$ and $\langle C_{0},\dots ,C_{m} \rangle$ respectively.
>
> 1. If $A \equiv \neg B$, then $\langle B_{0},\dots ,B_{n},\neg B_{n} \rangle$ is a formation sequence for $A$
> 2. If $A \equiv (B*C), *=\land, \lor, \rightarrow$, then $\langle B_{0},\dots ,B_{n}, C_{0},\dots, C_{m}, (B_{n}*C_{m}) \rangle$ is a formation sequence for $A$
> 3. If $A \equiv *xB, *=\exists, \forall$, then $\langle B_{0},\dots ,B_{n}, *xB \rangle$ is a formation sequence for $A$

**Lemma 6.28 (Sub-formation sequence)**: Suppose that $\langle A_{0},\dots ,A_{n} \rangle$ is a formation sequence for $A_{n}$, and that $k \le n$. Then $\langle A_{0},\dots ,A_{k} \rangle$ is a formation sequence for $A_{k}$

> **Proof**
>
> To show $\langle A_{0},\dots ,A_{k} \rangle$ is a formation sequence for $A_{k}$, we need to show that,
>
> (1) $A_{k} \equiv A_{k}$, which is obviously true, and
> (2) for all $i \le k$, either $A_{i}$ is an atomic formula, or there is some $p,q$ such that one of the following holds:

	1. $A_{i} \equiv \neg A_{p}$
	2. $A_{i} \equiv (A_{p}*A_{q}), *=\land, \lor, \rightarrow$
	3. $A_{i} \equiv *xA_{p},*=\exists, \forall$

>
> We know that $\langle A_{0},\dots ,A_{n} \rangle$ is a formation sequence for $A_{n}$. That is to say, (2) for all $i \le n$, either $A_{i}$ is an atomic formula, or there is some $p,q$ such that one of the following holds:

	4. $A_{i} \equiv \neg A_{p}$
	5. $A_{i} \equiv (A_{p}*A_{q}), *=\land, \lor, \rightarrow$
	6. $A_{i} \equiv *xA_{p},*=\exists, \forall$

>
> Since $k\le n$, (2) is also true. Therefore (1) and (2) are all true, making $\langle A_{0},\dots ,A_{k} \rangle$ a formation sequence for $A_{k}$.

**Theorem 6.29**: $Frm(\mathscr{L})$ is the set of all expressions (strings of symbols) in the language $\mathscr{L}$ with a formation sequence. ==??? What about formation sequence for terms? Guess you are saying "formation sequence of formulas"? But if that is so, then the proof is trivial. And you never define what is a standalone formation sequence==

> **Proof**
>
> We are proving the identify between two sets. Let $F$ be the set of all strings of symbols in $\mathscr{L}$ that have a formation sequence. We need to show that $F = Frm(\mathscr{L})$. We have shown that all formulas have formation sequence, i.e. $Frm(\mathscr{L}) \subseteq F$ in proposition 6.27. Now we need to show that $F \subseteq Frm(\mathscr{L})$.
> Suppose we have a formation sequence of a formula $\langle A_{0},\dots ,A_{n}\rangle$. For it to be a formation sequence, it must be the formation sequence for formula $A_{n}$.

**Proposition 6.30**: $Trm(\mathscr{L})$ is the set of all expressions $t$ in the language $\mathscr{L}$ such that there exists a (term) formulation sequence for $t$.

> **Proof**

Definition 6.31 (Minimal Formation Sequence)

: A formation sequence $\langle A_{0},\dots ,A_{n}\rangle$ for $A$ is a minimal formation sequence for $A$ if for every other formation sequence $s$ for $A$, the length is greater than or equal to $n+1$

**Proposition 6.32**: The following are equivalent:

1. $B$ is a subformula of $A$
2. $B$ occurs in every formation sequence of $A$
3. $B$ occurs in a minimal formation sequence of $A$

> **Proof**

### 6.8 Free variables and Sentences

Definition 6.33 (Free occurrences of a variable)

: The free occurrence of a variable in a formula are defined inductively as follows:

1. $A$ is atomic: all variable occurrences in $A$ are free
2. $A \equiv \neg B$: The free variable occurrences of $A$ are exactly those of $B$
3. $A \equiv (B * C)$: The free variable occurrences of $A$ are exactly those of $B$ and $C$
4. $A \equiv *xB$: The free variable occurrences of $A$ are exactly those of $B$ except $x$

Definition 6.34 (Bound Variables)

: An occurrence of a variable in a formula $A$ is *bound* if it is not free

Definition 6.35 (Scope)

~ If $\forall xB$ is an occurrence of a subformula in a formula $A$, then the corresponding occurrence of $B$ in $A$ is called the *scope* of the corresponding occurrence of $\forall x$. Similarly for $\exists x$.
~ If B is the scope of a quantifier occurrence $\forall x$ or $\exists x$ in $A$, then the free occurrences of $x$ in $B$ are bound in $\forall xB$ and $\exists xB$. We say that these occurrences are *bound by* the mentioned quantifier occurrence.

Definition 6.37 (Sentences)

: A formula $A$ is a sentence iff it contains no free occurrences of variables

### 6.9 Substitution

Definition 6.38 (Substitution in a term)

: Let $s$ be a string in $\mathscr{L}$. We define $s[t/x]$, the result of substituting $t$ for every occurrence of $x$ in $s$, recursively:

1. $s \equiv c: s[t/x]$ is just $s$
2. $s \equiv y: s[t/x]$ is just $s$ if $y \neq x$
3. $s \equiv x: s[t/x]$ is $t$
4. $s \equiv f(t_{1},\dots ,t_{n}):s[t/x]$ is $f(t_{1}[t/x],...,t_{n}[t/x])$

Definition 6.39 (Term t is free for x in A)

: A term $t$ is free for variable $x$ in formula $A$ if none of the free occurrences of $x$ in $A$ occur in the scope of a quantifier that binds a variable in $t$

> **Remark**: **"Term _t_ is free for _x_ in formula _A_"** means that you can safely substitute _t_ for all free occurrences of _x_ in _A_ without causing unintended variable capture. This condition is met if and only if no free occurrence of _x_ in _A_ falls under the scope of a quantifier that binds any variable present in _t_.

Definition 6.41 (Substitution in a formula)

: If $A$ is a formula, $x$ is a variable, and $t$ is a term free for $x$ in $A$, then $A[t/x]$ is the result of substituting $t$ for all free occurrence of $x$ in $A$.

1. $A \equiv \bot: A[t/x]$ is $\bot$
2. $A \equiv P(t_{1},\dots,t_{n}):A[t/x]$ is $P(t_{1}[t/x],\dots,t_{n}[t/x])$
3. $A \equiv t_{1}=t_{2}: A[t/x]$ is $t_{1}[t/x]=t_{2}[t/x]$
4. $A \equiv \neg B: A[t/x]$ is $\neg B[t/x]$
5. $A \equiv (B*C),*=\land, \lor, \rightarrow:A[t/x]$ is $(B[t/x]*C[t/x])$
6. $A \equiv *yB, *=\forall, \exists$: If $x=y$, then $A[t/x]$ is just $A$; otherwise $A[t/x]$ is $*yB[t/x]$

> **Remark**: This only substitutes free variables. All the bounded ones are untouched  to prevent the following from happening: $A \equiv \exists y x < y$ and $t \equiv y$, then $A[t/x]$ would be $\exists y y < y$

## Ch.7 Semantics of First-order Logic

### 7.2 Structures for First-order Languages

Definition 7.1 (Structures)

: A structure M, for a language $\mathscr{L}$ of first-order logic consists of the following elements:

1. *Domain*: A non-empty set $|M|$,
2. *Interpretation of constant symbols*: For each constant symbol $c$ of $\mathscr{L}$, there is an element $c^{M}\in |M|$
3. *Interpretation of predicate symbols*: For each $n$-place predicate symbol $R$ of $\mathscr{L}$ (other than =), an $n$-place relation $R^{M}\subseteq |M|^{n}$
4. *Interpretation of function symbols*: For each $n$-place function symbol of $f$ of $\mathscr{L}$, an $n$-place function $f^{M}:|M|^{n}\rightarrow |M|$

> **Remark**: $c^{M}$ can be understood as "the constant $c$ is interpreted by $M$ to be a member of $|M|$"; $R^{M}$ can be understood as "the predicate $R$ is interpreted by $M$ to be a member of $|M|^{n}$"; etc.

### 7.3 Covered Structures for First-order Languages

Definition 7.4 (Value of closed terms)

: If $t$ is a closed term of the language $\mathscr{L}$ and $M$ is a structure for $\mathscr{L}$, the value $Val^{M}(t)$ is defined as follows

1. If $t$ is just the constant symbol $c$, then $Val^{M}(c)=c^{M}$
2. If $t$ is of the form $f(t_{1},\dots,t_{n})$, then $$ Val^{M}(t)=f^M(Val^{M}(t_{1}),\dots,Val^{M}(t_{n}))$$

Definition 7.5 (Covered Structure)

: A structure is covered if every element of the domain is the value of some closed term.

> **Remark**: This is a "surjective" relation between value of all closed terms in $\mathscr{L}$ and $M$, and $|M|$

### 7.4 Satisfaction of a Formation in a Structure

Definition 7.7 (Variable Assignment)

: A variable assignment $s$ for a structure $M$ is a function which maps each variable to an element of $|M|$, i.e. $Var \rightarrow |M|$

> **Remark**: A structure assign values to constants; A variable assignment assigns values to variables.

**Definition 7.8 (Value of Terms)**

~ If

- $t$ is a term of the language $\mathscr{L}$,
- $M$ is a structure for $\mathscr{L}$, and
- $s$ is a variable assignment for $M$,

~ Then the value $Val^{M}_{s}(t)$ is defined as follows:

1. $t \equiv c: Val^M_s(t)=c^M$
2. $t \equiv x: Val^M_s(t)=s(x)$
3. $t \equiv f(t_{1},\dots,t_{n}):$ $$ Val^M _s(t)=f^M(Val^M_ s(t_{1}),\dots,Val^M_s(t_{n}))$$

Definition 7.9 (x-variant)

: If $s$ is a variable assignment for a structure $M$, then any variable assignment $s'$ for $M$ which differs from $s$ at most in what it assigns to $x$ is called an *$x$-variant* of $s$. If $s'$ is an $x$-variant of $s$ we write $s' \sim_{x} s$

> **Remark**: It's okay for $s'=s$

Definition 7.10 ($s[m/x]$)

: If $s$ is a variable assignment for a structure $M$ and $m \in |M|$, then the assignment $s[m/x]$ is the variable assignment defined by $$

s[m/x](y)=
\begin{cases}
m & \text{if } y \equiv x \\
s(y) & \text{otherwise} \\
\end{cases}$$

**Lemma**: Let $s$ be a variable assignment. $s[m_{1}/x]\dots[m_{i}/x]=s[m_{i}/x]$ for $i \in \mathbb{Z^{+}}$

**Proof of Lemma 1**: We prove by induction. When $i=1$ it is trivially true. Now assume $s[m_{1}/x]\dots[m_{n}/x]=s[m_{n}/x]$, we show that $s[m_{1}/x]\dots[m_{n}/x][m_{n+1}/x]=s[m_{n+1}/x]$. When $y \equiv x$, $s[m_{1}/x]\dots[m_{n}/x][m_{n+1}/x]=m_{n+1}=s[m_{n+1}/x]$. When $y \not\equiv x$, $s[m_{1}/x]\dots[m_{n}/x][m_{n+1}/x](y)=s[m_{1}/x]\dots[m_{n}/x](y)=s[m_{n}/x](y)=s(y)$, and $=s[m_{n+1}/x]=s(y)$. So in all cases we have $s[m_{1}/x]\dots[m_{n}/x][m_{n+1}/x]=s[m_{n+1}/x]$. This closes the induction.

Definition 7.11 (Satisfaction)

: Satisfaction of a formula $A$ in a structure $M$ relative to a variable assignment $s$, in symbols: $M,s \vDash A$, is defined recursively as follows.

1. $A \equiv \bot: M,s \nvDash A$
2. $A \equiv R(t_{1},\dots,t_{n}):M,s \vDash A$ iff $\langle Val^{M}_{s}(t_{1}),\dots,Val^{M}_{s}(t_{n})\rangle\in R^{M}$
3. $A \equiv t_{1}=t_{2}: M,s \vDash A$ iff $Val^M_s(t_1)=Val^M_s(t_2)$
4. $A \equiv \neg B: M,s \vDash A$ iff $M,s \nvDash B$
5. $A \equiv (A \land B): M,s \vDash A$ iff $M,s \vDash B$ and $M,s \vDash A$
6. $A \equiv (A \lor B): M,s \vDash A$ iff $M,s \vDash B$ or $M,s \vDash A$ (or both)
7. $A \equiv (A \rightarrow B): M,s \vDash A$ iff $M,s \nvDash B$ or $M,s \vDash A$ (or both)
8. $A \equiv \forall x B: M,s \vDash A$ iff for any element $m \in |M|, M,s[m/x]\vDash B$
9. $A \equiv \exists x B: M,s \vDash A$ iff for at least one element $m \in |M|, M,s[m/x]\vDash B$

### 7.5 Variable Assignment

**Proposition 7.13** If the variables in a term $t$ are among $x_{1},\dots,x_{n}$, and $s_{1}(x_{i})=s_{2}(x_{i})$ for $i=1,\dots,n$, then $Val_{s_{1}}^{M}(t)=Val_{s_{2}}^{M}(t)$

> **Proof**
>
> (1) $t \equiv c, Val^{M}_{s_{1}}(t)=Val^{M}_{s_{2}}(t)=c$
> (2) $t \equiv x, Val^{M}_{s_{1}}(t)=s_{1}(x)=s_{2}(x)=Val^{M}_{s_{2}}(t)$
> (3) Assume this holds for all $t_{1},\dots,t_{n}$, $$\begin{aligned}
& Val^{M}_{s_{1}}(f(t_{1},\dots, t_{n})) \\
= & f^{M}(Val^{M}_{s_{1}}(t_{1}),\dots, Val^{M}_{s _{1}}(t_{n})) \\
= & f^{M}(Val^{M}_{s_{2}}(t_{1}),\dots, Val^{M}_{s _{2}}(t_{n})) \\
= & Val^{M}_{s_{2}}(f(t_{1},\dots, t_{n}))
\end{aligned}$$

**Proposition 7.14**: If the free variables in formula $A$ are among $x_{1},\dots,x_{n}$, and $s_{1}(x_{i})=s_{2}(x_{i})$ for $i=1,\dots,n$, then $M,s_{1}\vDash A$ iff $M,s_{2}\vDash A$

> **Proof**
>
> 1. $A \equiv \bot: M, s_{1} \nvDash \bot$ and $M, s_{2} \nvDash \bot$
> 2. $A \equiv R(t_{1},\dots, t_{n}):$ Given proposition 7.13, if $\langle Val^{M}_{s_{1}}(t_{1}),\dots,Val^{M}_{s_{1}}(t_{n}) \rangle \in R^{M}$, then $\langle Val^{M}_{s_{2}}(t_{1}),\dots,Val^{M}_{s_{2}}(t_{n}) \rangle \in R^{M}$. The converse also holds.
> 3. $A \equiv t_{1}=t_{2}:$ Given proposition 7.13, if $Val^M_{s_1}(t_1)=Val^M_{s_1}(t_2)$ then $Val^M_{s_2}(t_1)=Val^M_{s_2}(t_2)$. The converse also holds.
> 4. $A \equiv \neg B:$ Suppose $M,s_{1} \vDash B$ iff $M, s_{2} \vDash B$, then either $M,s_{1} \vDash B \land M,s_{2} \vDash B$ or $M,s_{1} \nvDash B \land M,s_{2} \nvDash B$. Either case it holds.
> 5. $A \equiv (A \land B):$ Suppose $M,s_{1} \vDash A,B$ iff $M,s_{2} \vDash A,B$, again either two cases holds. Again, it is obvious that the conclusion holds.
> 6. $A \equiv (A \lor B):$ Again there are two cases. and again the conclusion holds
> 7. $A \equiv (A \rightarrow B):$ Similarly, this holds
> 8. $A \equiv \forall x B:$ Suppose either

	- $M, s_{1} \vDash B$ and $M,s_{2} \vDash B$, or
	- $M, s_{1} \nvDash B$ and $M,s_{2} \nvDash B$

>	Now we need to show first $M, s_{1} \vDash \forall x B \rightarrow M, s_{2} \vDash \forall x B$, and then $M, s_{1} \vDash \forall x B \rightarrow M, s_{2} \vDash \forall x B$.
>	Given that for all $m \in |M|$, $M, s_{1}[m/x]\forall xB$
> 9. $A \equiv \exists x B: M,s \vDash A$ iff for at least one element $m \in |M|, M,s[m/x]\vDash B$

**Proposition 7.14**: If the free variables in formula $A$ are among $x_{1},\dots,x_{n}$, and $s_{1}(x_{i})=s_{2}(x_{i})$ for $i=1,\dots,n$, then $M,s_{1}\vDash A$ iff $M,s_{2}\vDash A$

**Corollary 7.15** If $A$ is a *sentence* and $s$ a variable assignment, then $M,s \vDash A$ iff $M,s' \vDash A$ for every variable assignment $s'$

> **Proof**
>
> This is obvious, since A is a sentence, meaning there's no free variables

**Proposition 7.17**: Let $M$ be a structure, $A$ be a sentence, and $s$ a variable assignment. $M \vDash A$ iff $M,s \vDash A$

> **Proof**
>
> This is as obvious as 7.15

**Proposition 7.18**: Suppose $A(x)$ only contains $x$ free, and $M$ is a structure. Then:

1. $M \vDash \exists x A(x)$ iff $M,s \vDash A(x)$ for at least one variable assignment $s$
2. $M \vDash \forall x A(x)$ iff $M,s \vDash A(x)$ for all variable assignment $s$

### 7.6 Extensionality

**Proposition 7.19 (Extensionality)**: Let $A$ be a formula, and $M_{1}$ and $M_{2}$ be structures with $|M_{1}|=|M_{2}|$, and $s$ a variable assignment on $|M_{1}|=|M_{2}|$. If for any constant $c$, relation $R$ or function $f$ in $A$, we have $c^{M_{1}}=c^{M_{2}},R^{M_{1}}=R^{M_{2}},f^{M_{1}}=f^{M_{2}}$, then $M_{1},s \vDash A$ iff $M_{2},s \vDash A$

> **Proof**
>
> First prove that $Val^{M_{1}}_{s}(t)=Val^{M_{2}}_{s}(t)$ for any $t$, then prove this conclusion

**Corollary 7.20 (Extensionality for Sentences)**. Let $A$ be a sentence and $M_{1}$ , $M_{2}$ as in Proposition 7.19. Then $M_{1} \vDash A$ iff $M_{2} \vDash A$.

> **Proof**
>
> This follows from proposition 7.19 and corollary 7.15

**Proposition 7.21**: Let $M$ be a structure, $t$ and $t'$ terms and $s$ a variable assignment. Then $Val^{M}_{s}(t[t'/x])=Val^{M}_{s[Val^{M}_{s}(t')/x]}(t)$

> **Proof**
>
> Induct on $t$

**Proposition 7.22**: Let $M$ be a structure, $A$ a formula, $t'$ a term and $s$ a variable assignment. Then $M,s \vDash A[t'/x]$ iff $M,s[Val_{s}^{M}(t')/x]\vDash A$

> **Proof**

### 7.7 Semantic Notions

Definition 7.23 (Validity)

: A sentence is *valid*, $\vDash A$ iff $M \vDash A$ for every structure $M$

Definition 7.24 (Entailment)

: A set of sentences $\Gamma$ *entails* a sentence $A,\Gamma \vDash A$ iff for every structure $M$ that $M \vDash \Gamma, M \vDash A$ ==The reason why set is introduced is because infinite conjunction might be problematic==

Definition 7.25 (Satisfiability)

: A set of sentences $\Gamma$ is *satisfiable* if $M \vDash \Gamma$ for some structure $M$. If $\Gamma$ is not satisfiable it is called unsatisfiable.

Definition  (Model satisfy a set of sentences)

: $M \vDash \Gamma$ iff $x \in \Gamma, M \vDash \Gamma$

**Proposition 7.26**: A sentence $A$ is valid iff $\Gamma \vDash A$ for any set of sentences $\Gamma$

> **Proof**
>
> Left to right: Since every structure $M$ satisfy $A$, the structure that satisfy $\Gamma$ will also satisfy A
> Right to left: prove by reductio

**Proposition 7.27**: $\Gamma \vDash A$ iff $\Gamma \cup \{\neg A\}$ is unsatisfiable

> **Proof**
>
> Left to right: Reductio. Suppose $\Gamma \vDash A$ and there is some structure $M$ such that $M \vDash \Gamma \cup \{\neg A\}$. Then $M \vDash \Gamma$ and $M \vDash \neg A$, which $M \nvDash A$. But we know from inductive hypothesis that If $M \vDash \Gamma$ then $M \vDash A$. Contradiction.

**Proposition 7.28**: If $\Gamma \subseteq \Gamma'$ and $\Gamma \vDash A$, then $\Gamma' \vDash A$

> **Proof**
>
> Assume $\Gamma \subseteq \Gamma'$, any structure $M$ such that $M \vDash \Gamma, M \vDash A$ and there is some structure $M'$ such that $M \vDash \Gamma'$. Now we want to show that $M' \vDash A$. This is now very obvious.

**Theorem 7.29 (Semantic Deduction Theorem)**: $\Gamma \cup \{A\} \vDash B$ iff $\Gamma \vDash A \rightarrow B$

> **Proof**: Easy.

**Proposition 7.30**: Let $M$ be a structure, and $A(x)$ a formula with one free variable $x$, and $t$ a closed term. Then:

1. $A(t) \vDash \exists x A(x)$
2. $\forall A(x) \vDash A(t)$

## Ch.8 Theories and their models

Definition 8.1

: A set of sentence $\Gamma$ is *closed* iff, whenever $\Gamma \vDash A$ then $A \in \Gamma$. The closure of a set of sentences $\Gamma$ is $\{A:\Gamma \vDash A\}$. We say that $\Gamma$ is *axiomatized by* a set of sentence $\Delta$ if $\Gamma$ is the closure of $\Delta$

> **Remark**: A set of sentences is closed if everything that it entails are a member of this set. The closure of a set of sentence is just whatever the sentence entails.

Definition 8.2 (Model of a set)

: Let $\Gamma$ be a set of sentences in a language $\mathscr{L}$. We say that a structure $M$ *is a model of* $\Gamma$ if $M \vDash A$ for all $A \in \Gamma$

Definition 8.9

: Let $A(v_{1},\dots,v_{n})$ be a formula of $\mathscr{L}$ in which only $v_{1},\dots,v_{n}$ occur free, and let $M$ be a structure for $\mathscr{L}$. $A(v_{1},\dots,v_{n})$ expresses the relation $R \subseteq |M|^{n}$ iff $$Ra_{1}\dots a_{n} \leftrightarrow M,s \vDash A(v_{1},\dots,v_{n})$$ for any variable assignment $s$ with $s(v_{i})= a_{i}, i = 1,\dots,n$

## Ch.11 Natural Deduction

Definition 11.1 Assumption

: An assumption is any sentence in the topmost position of any branch

Definition 11.2 (Derivation)

~ A derivation of a sentence $A$ from assumptions $\Gamma$ is a *finite* tree of sentences satisfying the following conditions:

1. The topmost sentences of the tree are either in $\Gamma$ or are discharged by an inference in the tree
2. The bottommost sentence of the tree is $A$
3. Every sentence in the tree except the sentence $A$ at the bottom is a premise of a correct application of an inference rule whose conclusion stands directly below that sentence in the tree

~ We then say that $A$ is the conclusion of the derivation and $\Gamma$ its undischarged assumption. If a derivation of $A$ from $\Gamma$ exists, we say that $A$ is derivable from $\Gamma$, or in symbols: $\Gamma \vdash A$. If there is a derivation of $A$ in which every assumption is discharged, we write $\vdash A$

Definition 11.10 (Theorems)

: A sentence $A$ is a *theorem* if there is a derivation of $A$ in natural deduction in which all assumptions are discharged. We write $\vdash A$ if $A$ is a theorem and $\nvdash A$ if it is not.

Definition 11.11 (Derivability)

: A sentence A is derivable from a set of sentences $\Gamma$, $\Gamma \vdash A$, if there is a derivation with conclusion $A$ and in which every assumption is either discharged or is in $\Gamma$. If $A$ is not derivable from $\Gamma$ we write $\Gamma \nvdash A$

Definition 11.12 (Consistency)

: A set of sentences $\Gamma$ is *inconsistent* iff $\Gamma \vdash \bot$. If $\Gamma$ is not inconsistent, i.e. $\Gamma \nvdash \bot$, we say it is *consistent*

**Proposition 11.13 (Reflexivity)**: If $A \in \Gamma$, then $\Gamma \vdash A$

**Proposition 11.14 (Monotonicity)**: If $\Gamma \subseteq \Delta$ and $\Gamma \vdash A$, then $\Delta \vdash A$

**Proposition 11.15 (Transitivity)**: If $\Gamma \vdash A$ and $\{A\} \cup \Delta \vdash B$, then $\Gamma \cup \Delta \vdash B$

**Proposition 11.16**: The following are equivalent.

1. $\Gamma$ is inconsistent.
2. $\Gamma \vdash A$ for every sentence $A$
3. $\Gamma \vdash A$ and $\Gamma \vdash \neg A$ for sentence $A$

**Proposition 11.17 (Compactness)**:

1. If $\Gamma \vdash A$ then there is a finite subset $\Gamma_{0} \subseteq \Gamma$ such that $\Gamma_{0} \vdash A$
2. If every finite subset of $\Gamma$ is consistent, then $\Gamma$ is consistent

**Proposition 11.18**: If $\Gamma \vdash A$ and $\Gamma \cup \{A\}$ is *inconsistent*, then $\Gamma$ is *inconsistent*.

> Proof

$$

\begin{prooftree}
\alwaysNoLine

\AxiomC{$\Gamma,[A]^1$}
\UIC{$\vdots \delta_{2}$}
\UIC{$\bot$}

\LeftLabel{$1$}
\RightLabel{$\neg$I}
\singleLine

\UIC{$\neg A$}

\AXC{$\Gamma$}
\UIC{$\vdots \delta_{1}$}
\UIC{$A$}

\RightLabel{$\neg$E}
\singleLine
\BIC{$\bot$}

\end{prooftree}

$$

**Proposition 11.19**: $\Gamma \vdash A$ iff $\Gamma \cup \{\neg A\}$ is *inconsistent*

**Proposition 11.20**: If $\Gamma \vdash A$ and $\neg A \in \Gamma$, then $\Gamma$ is *inconsistent*

**Proposition 11.21**: If $\Gamma \cup \{A\}$ and $\Gamma \cup \{\neg A\}$ are both *inconsistent*, then $\Gamma$ is *inconsistent*

**Proposition 11.22**:

1. Both $A \land B \vdash A$ and $A \land B \vdash B$
2. $A,B \vdash A \land B$

**Proposition 11.23**:

1. $A \lor B. \neg A, \neg B$ is inconsistent
2. Both $A \vdash A \lor B$ and $B \vdash A \lor B$

**Proposition 11.24**:

1. $A,A \rightarrow B \vdash B$
2. Both $\neg A \vdash A \rightarrow B$ and $B \vdash A \rightarrow B$

**Theorem 11.25**: If $c$ is a constant not occurring in $\Gamma$ or $A(x)$ and $\Gamma \vdash A(c)$, then $\Gamma \vdash \forall x A(x)$

**Proposition 11.26**:

1. $A(t) \vdash \exists x A(x)$
2. $\forall x A(x) \vdash A(t)$

**Theorem 11.27 (Soundness)**: If A is a derivable from the undischarged assumptions $\Gamma$, then $\Gamma \vDash A$ ==complicated==

**Corollary 11.28**: If $\vdash A$, then $A$ is valid

**Corollary 11.29**: If $\Gamma$ is satisfiable, then it is consistent

**Proposition 11.32**. Natural deduction with rules for $=$ is sound.

## Chap. 12 The Completeness Theorem

model existence result: every consistent set of sentences is satisfiable

proposition: $\Gamma \vDash A \rightarrow \Gamma \vdash A$

outline of the proof

suppose $\Gamma$ only includes atomic sentences

Consider $P(a_{1},\dots,a_{n})$ where $a_{1},\dots,a_{n}$ are constants. Let $|M|=\mathbb{N}$, and we interpret each constant $a_{n}^{M}$ to a natural number $i$. Then we can construct $P^{M}$ such that $\langle k_{1},\dots,k_{n} \rangle$, where n is the index of $a$

The upshot is that, we construct some model to satisfy it.

Consider $\neg B$. Since $\Gamma$ is consistent, then we ensured that $B$ is not in $\Gamma$. Then we can ad hoc construct $M \nvDash B$, and therefore $M \vDash \neg B$

Definition 12.1 (Complete set)

: A set $\Gamma$ of sentences is *complete* iff for any sentence $A$, either $A \in \Gamma$ or $\neg A \in \Gamma$

> **Remark**: A complete set of sentences determines all the truth values.

**Proposition 12.2**: Suppose $\Gamma$ is complete and consistent. Then:

1. If $\Gamma \vdash A$, then $A \in \Gamma$
2. $A \land B \in \Gamma$ iff both $A \in \Gamma$ and $B \in \Gamma$
3. $A \lor B \in \Gamma$ iff either $A \in \Gamma$ or $B \in \Gamma$
4. $A \rightarrow B \in \Gamma$ iff either $A \notin \Gamma$ or $B \in \Gamma$

> **Proof**
>
> (1) suppose $\Gamma \vdash A$, and by reductio we suppose $A \notin \Gamma$. Since $\Gamma$ is complete, $\neg A \in \Gamma$. Therefore $\Gamma \vdash A$, therefore $\Gamma \vdash \bot$. But $\Gamma$ is consistent. Contradiction.
> (3) left to right: suppose $A \lor B \in \Gamma$, and by reductio we have $A \notin \Gamma$ and $B \notin \Gamma$. Obviously, $\Gamma \vdash \bot$.

### Henkin Expansion

**Proposition 12.3**: If $\Gamma$ is consistent in $\mathscr{L}$ and $\mathscr{L}'$ is obtained from $\mathscr{L}$ by adding a countably infinite set of new constant symbols $d_{0},d_{1},\dots,$ then $\Gamma$ is consistent in $\mathscr{L}'$

Definition 12.4 (Saturated set)

: A set $\Gamma$ of formulas of a language $\mathscr{L}$ is *saturated* iff for each formula $A(x) \in Frm(\mathscr{L})$ with one free variable $x$ there is a constant symbol $c \in \mathscr{L}$ such that $\exists x A(x) \rightarrow A(c) \in \Gamma$

Definition 12.5

~ Let $\mathscr{L}'$ be as in proposition 12.3. Fix an enumeration $A_{0}(x_{0}),A_{1}(x_{1}),\dots$ of all formulas $A_{i}(x_{i})$ of $\mathscr{L}'$ in which one variable $(x_{i})$ occurs free. We define the sentences $D_{n}$ by induction on $n$.
~ Let $c_{0}$ be the first constant symbol among the $d_{i}$ we added to $\mathscr{L}$ which does not occur in $A_{0}(x_{0})$. Assuming that $D_{0},\dots,D_{n-1}$ have already been defined, let $c_{n}$ be the first among the new constant symbols $d_{i}$ that occurs neither $D_{0},\dots,D_{n-1}$ nor in $A_{n}(x_{n})$.
~ Now let $D_{n}$ be the formula $\exists x_{n}A_{n}(x_{n}) \rightarrow A_{n}(c_{n})$

**Lemma 12.6**: Every consistent set $\Gamma$ can be extended to a saturated consistent set $\Gamma'$

**Proposition 12.7**: Suppose $\Gamma$ is complete, consistent, and saturated.

1. $\exists x A(x) \in \Gamma$ iff $A(t) \in \Gamma$ for at least one closed term $t$
2. $\forall x A(x) \in \Gamma$ iff $A(t) \in \Gamma$ for all closed terms $t$

### Lindenbaum's Lemma

**Lemma 12.8 (Lindenbaum's Lemma)** Every consistent set $\Gamma$ in a language $\mathscr{L}$ can be extended to a complete and consistent set $\Gamma^{*}$

...(See handout)

## Chap. 14 Turing Machine

Definition (Turing Machine)

: A Turing Machine $M$ is a tuple $\langle Q, \Sigma, q_{0}, \delta \rangle$ consisting of:

1. A *finite* state of *states* $Q$,
2. A *finite* alphabet (vocabulary/types of input) which includes a start symbol and empty symbol
3. An initial state $q_{0} \in Q$
4. A finite instruction set $\delta$, which is a partial function

Definition 14.7 (Configuration).

: A configuration of Turing machine M = ⟨Q , 𝛴 ,q 0 , 𝛿⟩ is a triple ⟨C ,m,q ⟩ where

1. C ∈ 𝛴 ∗ is a finite sequence of symbols from 𝛴 ,
2. m ∈ N is a number < len(C ), and
3. q ∈ Q

Intuitively, the sequence C is the content of the tape (symbols of all squares from the leftmost square to the last non-blank or previously visited square),
m is the number of the square the read/write head has been scanning (beginning with 0 being the number of the leftmost square), and
q is the current state of the machine.

Definition 14.8 (Initial configuration).

: The initial configuration of M for input I ∈ 𝛴 ∗ is  ⟨⊲ ⌢ I , 1,q 0 ⟩.

Definition 14.9.

: We say that a configuration ⟨C ,m,q ⟩ yields the configuration ⟨C ′ ,m ′ ,q ′ ⟩ in one step (according to M ), iff

1. the m-th symbol of C is 𝜎,
2. the instruction set of M specifies 𝛿(q , 𝜎) = ⟨q ′ , 𝜎 ′ ,D⟩,
3. the m-th symbol of C ′ is 𝜎 ′ , and
4.
	a) D = L and m ′ = m − 1 if m > 0, otherwise m ′ = 0, or
	b) D = R and m ′ = m + 1, or
	c) D = N and m ′ = m,
5. if m ′ = len(C ), then len(C ′ ) = len(C ) + 1 and the m ′ -th symbol of C ′ is ⊔. Otherwise len(C ′ ) = len(C ).
6. for all i such that i < len(C ) and i ≠ m, C ′ (i ) = C (i ),

Definition 14.10

~ *A run of M on input I* is a sequence C i of configurations of M , where C 0 is the initial configuration of M for input I , and each C i yields C i +1 in one step.
~ We say that *M halts on input I* after k steps if C k = ⟨C ,m,q ⟩, the mth symbol of C is 𝜎, and 𝛿(q , 𝜎) is undefined. In that case,
~ the *output of M* for input I is O , where O is a string of symbols not ending in ⊔ such that C = ⊲ ⌢ O ⌢ ⊔ j for some i , j ∈ N.

Definition 14.11 (Computation).

: A Turing machine M computes the function f : N k → N iff M halts on input $I^{n_{1}} ⊔ I^{n_{2}} ⊔ \dots ⊔ I^{n_{k}}$ with output $I^{f(n_{1},\dots,n_{k})}$

**Remark**: All arguments are separated by a blank.

Definition 14.15.

: A Turing machine M computes the partial

function f : $N^{k} \rightarrow N$ iff,

1. M halts on input I n 1 ⌢ ⊔ ⌢ . . . ⌢ ⊔ ⌢ I nk with output

I m if f (n 1 , . . . ,n k ) = m.
2.M does not halt at all, or with an output that is not a single
block of I ’s if f (n 1 , . . . ,n k ) is undefined.

Definition 14.17.

: A Turing machine M is disciplined iff

1. it has a designated single halting state h,
2. it halts, if it halts at all, while scanning square 1,
3. it never erases the ⊲ symbol on square 0, and
4. it never attempts to move left from square 0.
