var documenterSearchIndex = {"docs":
[{"location":"#ThreadsX.jl","page":"Home","title":"ThreadsX.jl","text":"","category":"section"},{"location":"","page":"Home","title":"Home","text":"ThreadsX\nThreadsX.foreach\nThreadsX.map!\nThreadsX.sort!\nThreadsX.sort\nThreadsX.MergeSort\nThreadsX.QuickSort","category":"page"},{"location":"#ThreadsX","page":"Home","title":"ThreadsX","text":"Threads⨉: Parallelized Base functions\n\n(Image: Dev) (Image: GitHub Actions) (Image: Aqua QA)\n\ntl;dr\n\nAdd prefix ThreadsX. to functions from Base to get some speedup, if supported.  Example:\n\njulia> using ThreadsX\n\njulia> ThreadsX.sum(gcd(42, i) == 1 for i in 1:10_000)\n2857\n\nTo find out functions supported by ThreadsX.jl, just type ThreadsX. + TAB in the REPL:\n\njulia> ThreadsX.\nMergeSort       any             findlast        mapreduce       sort\nQuickSort       count           foreach         maximum         sort!\nSet             extrema         issorted        minimum         sum\nStableQuickSort findall         map             prod            unique\nall             findfirst       map!            reduce\n\nInteroperability\n\nRich collection support\n\nThe reduce-based functions support any collections that implement SplittablesBase.jl interface including arrays, Dict, Set, and iterator transformations.  In particular, these functions support iterator comprehension:\n\njulia> ThreadsX.sum(y for x in 1:10 if isodd(x) for y in 1:x^2)\n4917\n\nFor advanced usage, they also support Transducers.eduction constructed with parallelizable transducers.\n\nOnlineStats.jl\n\nThreadsX.reduce supports an OnlineStat from OnlineStats.jl as the first argument as long as it implements the merging interface:\n\njulia> using OnlineStats: Mean\n\njulia> ThreadsX.reduce(Mean(), 1:10)\nMean: n=10 | value=5.5\n\nAPI\n\nThreadsX.jl is aiming at providing API compatible with Base functions to easily parallelize Julia programs.\n\nAll functions that exist directly under ThreadsX namespace are public API and they implement a subset of API provided by Base. Everything inside ThreadsX.Implementations is implementation detail. The public API functions of ThreadsX expect that the data structure and function(s) passed as argument are \"thread-friendly\" in the sense that operating on distinct elements in the given container from multiple tasks in parallel is safe. For example, ThreadsX.sum(f, array) assumes that executing f(::eltype(array)) and accessing elements as in array[i] from multiple threads is safe.  In particular, this is the case if array is a Vector of immutable objects and f is a pure function in the sense it does not mutate any global objects.  Note that it is not required and not recommended to use \"thread-safe\" array that protects accessing array[i] by a lock.\n\nIn addition to the Base API, all functions accept keyword argument basesize::Integer to configure the number of elements processed by each thread.  A large value is useful for minimizing the overhead of using multiple threads.  A small value is useful for load balancing when the time to process single item varies a lot from item to item. The default value of basesize for each function is currently an implementation detail.\n\nThreadsX.jl API is deterministic in the sense that the same input produces the same output, independent of how julia's task scheduler decide to execute the tasks.  However, note that basesize is a part of the input which may be set based on Threads.nthreads().  To make the result of the computation independent of Threads.nthreads() value, basesize must be specified explicitly.\n\nLimitations\n\nKeyword argument dims is not supported yet.\n(There are probably more.)\n\nImplementations\n\nMost of reduce-based functions are implemented as thin wrappers of Transducers.jl.\n\nCustom collections can support ThreadsX.jl API by implementing SplittablesBase.jl interface.\n\n\n\n\n\n","category":"module"},{"location":"#ThreadsX.foreach","page":"Home","title":"ThreadsX.foreach","text":"ThreadsX.foreach(f, collections...; basesize, simd)\n\nA parallel version of\n\nfor args in zip(collections...)\n    f(args...)\nend\n\nThreadsX.foreach uses linear and Cartesian indexing of arrays appropriately.  However, it is likely very slow for sparse arrays.\n\nAlthough ThreadsX.foreach can be nested, it is highly recommended to use CartesianIndices or Iterators.product whenever applicable so that ThreadsX.foreach can load-balance across multiple levels of loops.  Otherwise (when nesting ThreadsX.foreach) it is important to set basesize for outer loops to small values (e.g., basesize = 1).\n\nKeyword Arguments\n\nbasesize: The size of base case.\nsimd: false, true, :ivdep, or Val of one of them.  If true/:ivdep, the inner-most loop of each base case is annotated by @simd/@simd ivdep.  This does not occur if false (default).\n\nExamples\n\njulia> using ThreadsX\n\njulia> xs = 1:10; ys = similar(xs);\n\njulia> ThreadsX.foreach(eachindex(ys, xs)) do I\n           @inbounds ys[I] = xs[I]\n       end\n\nAs foreach can only be used for side-effects, it is likely that it has to be used with eachindex.\n\nTo avoid cumbersome indexing, a powerful pattern is to use Referenceables.jl with foreach:\n\njulia> using Referenceables  # exports `referenceable`\n\njulia> ThreadsX.foreach(referenceable(ys), xs) do y, x\n           y[] = x\n       end\n\nNote that y[] does not have to be marked by @inbounds as it is ensured to be the reference to the valid location in the array.\n\nAbove function can also be written using map!.  foreach is useful when, e.g., there are multiple outputs:\n\njulia> A = randn(10, 10); sums = similar(A); muls = similar(A);\n\njulia> ThreadsX.foreach(referenceable(sums), referenceable(muls), A, A') do s, m, x, y\n           s[] = x + y\n           m[] = x * y\n       end\n\nAbove code fuses the computation of sums .= A .+ A' and muls .= A .* A' and runs it in parallel.\n\nforeach can also be used when the array is both input and output:\n\njulia> ThreadsX.foreach(referenceable(A)) do x\n           x[] *= 2\n       end\n\nNested loops can be written using Iterators.product:\n\njulia> A = 1:3\n       B = 1:2\n       C = zeros(3, 2);\n\njulia> ThreadsX.foreach(referenceable(C), Iterators.product(A, B)) do c, (a, b)\n           c[] = a * b\n       end\n       @assert C == A .* reshape(B, 1, :)\n\nThis is equivalent to the following sequential code\n\njulia> for j in eachindex(B), i in eachindex(A)\n           @inbounds C[i, j] = A[i] * B[j]\n       end\n       @assert C == A .* reshape(B, 1, :)\n\nThis loop can be expressed also with explicit indexing (which is closer to the sequential code):\n\njulia> ThreadsX.foreach(Iterators.product(eachindex(A), eachindex(B))) do (i, j)\n           @inbounds C[i, j] = A[i] * B[j]\n       end\n       @assert C == A .* reshape(B, 1, :)\n\njulia> ThreadsX.foreach(CartesianIndices(C)) do I\n           @inbounds C[I] = A[I[1]] * B[I[2]]\n       end\n       @assert C == A .* reshape(B, 1, :)\n\nNote the difference in the ordering in the syntax; i.e., for j in eachindex(B), i in eachindex(A) and Iterators.product(eachindex(A), eachindex(B)).  These are equivalent in the sense eachindex(A) is the inner most loop in both cases.\n\n\n\n\n\n","category":"function"},{"location":"#ThreadsX.map!","page":"Home","title":"ThreadsX.map!","text":"ThreadsX.map!(f, dest, inputs...; basesize, simd)\n\nParallelized map!.  See also foreach.\n\nLimitations\n\nNote that the behavior is undefined when using dest whose distinct indices refer to the same memory location.  In particular:\n\nSubArray with overlapping indices. For example, view(zeros(2), [1, 1, 2, 2]) is unsupported but view(zeros(10), [1, 5, 4, 7]) is safe to use.\nBitArray (currently unsupported)\n\n\n\n\n\n","category":"function"},{"location":"#ThreadsX.sort!","page":"Home","title":"ThreadsX.sort!","text":"ThreadsX.sort!(xs; [smallsort, smallsize, basesize, alg, lt, by, rev, order])\n\nSort a vector xs in parallel.\n\nExamples\n\njulia> using ThreadsX\n\njulia> ThreadsX.sort!([9, 5, 2, 0, 1])\n5-element Array{Int64,1}:\n 0\n 1\n 2\n 5\n 9\n\njulia> ThreadsX.sort!([0:5;]; alg = ThreadsX.StableQuickSort, by = _ -> 1)\n6-element Array{Int64,1}:\n 0\n 1\n 2\n 3\n 4\n 5\n\nIt is also possible to use Base.sort! directly by specifying alg to be one of the parallel sort algorithms provided by ThreadsX:\n\njulia> sort!([9, 5, 2, 0, 1]; alg = ThreadsX.MergeSort)\n5-element Array{Int64,1}:\n 0\n 1\n 2\n 5\n 9\n\nThis entry point may be slower than ThreadsX.sort! if the input is a very large array of integers with small range.  In this case, ThreadsX.sort! uses parallel counting sort whereas sort! uses sequential counting sort.\n\nKeyword Arguments\n\nalg :: Base.Sort.Algorithm: ThreadsX.MergeSort, ThreadsX.QuickSort, ThreadsX.StableQuickSort etc. Base.MergeSort and Base.QuickSort can be used as aliases of ThreadsX.MergeSort and ThreadsX.QuickSort.\nsmallsort :: Union{Nothing,Base.Sort.Algorithm}:  The algorithm to use for sorting small chunk of the input array.\nsmallsize :: Union{Nothing,Integer}: Size of array under which smallsort algorithm is used.  nothing (default) means to use basesize.\nbasesize :: Union{Nothing,Integer}.  Granularity of parallelization. nothing (default) means to choose the default size.\nFor keyword arguments, see Base.sort!.\n\n\n\n\n\n","category":"function"},{"location":"#ThreadsX.sort","page":"Home","title":"ThreadsX.sort","text":"ThreadsX.sort(xs; [smallsort, smallsize, basesize, alg, lt, by, rev, order])\n\nSee also ThreadsX.sort!.\n\n\n\n\n\n","category":"function"},{"location":"#ThreadsX.MergeSort","page":"Home","title":"ThreadsX.MergeSort","text":"ThreadsX.MergeSort\n\nParallel merge sort algorithm.\n\nSee also ThreadsX.QuickSort.\n\nExamples\n\nThreadsX.MergeSort is a Base.Sort.Algorithm, just like Base.MergeSort.  It has a few properties for configuring the algorithm.\n\njulia> using ThreadsX\n\njulia> ThreadsX.MergeSort isa Base.Sort.Algorithm\ntrue\n\njulia> ThreadsX.MergeSort.smallsort === Base.Sort.DEFAULT_STABLE\ntrue\n\nThe properties can be \"set\" by calling the algorithm object itself.  A new algorithm object with new properties given by the keyword arguments is returned:\n\njulia> alg = ThreadsX.MergeSort(smallsort = QuickSort) :: Base.Sort.Algorithm;\n\njulia> alg.smallsort == QuickSort\ntrue\n\njulia> alg2 = alg(basesize = 64, smallsort = InsertionSort);\n\njulia> alg2.basesize\n64\n\njulia> alg2.smallsort === InsertionSort\ntrue\n\nProperties\n\nsmallsort :: Base.Sort.Algorithm: Default to Base.Sort.DEFAULT_STABLE.\nsmallsize :: Union{Nothing,Integer}: Size of array under which smallsort algorithm is used.  nothing (default) means to use basesize.\nbasesize :: Union{Nothing,Integer}.  Base case size of parallel merge. nothing (default) means to choose the default size.\n\n\n\n\n\n","category":"constant"},{"location":"#ThreadsX.QuickSort","page":"Home","title":"ThreadsX.QuickSort","text":"ThreadsX.QuickSort\nThreadsX.StableQuickSort\n\nParallel quick sort algorithms.\n\nSee also ThreadsX.MergeSort.\n\nProperties\n\nsmallsort :: Base.Sort.Algorithm: Default to Base.Sort.DEFAULT_UNSTABLE.\nsmallsize :: Union{Nothing,Integer}: Size of array under which smallsort algorithm is used.  nothing (default) means to use basesize.\nbasesize :: Union{Nothing,Integer}.  Granularity of parallelization. nothing (default) means to choose the default size.\n\n\n\n\n\n","category":"constant"}]
}
