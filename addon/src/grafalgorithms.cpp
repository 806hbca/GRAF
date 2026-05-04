// addon/src/grafalgorithms.cpp
#include <napi.h>
#include <cmath>
#include <vector>
#include <unordered_map>
#include <list>
#include <algorithm>
#include <queue>
#include <limits>
#include <stack>
#include <functional>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct Point
{
    int vertex;
    double weight;
    Point(int v, double w) : vertex(v), weight(w) {}
};

class GRAF
{
private:
    std::unordered_map<int, std::list<Point>> adjacencyList;
    int numVertices;

public:
    GRAF() : numVertices(0) {}

    void buildFromMatrix(const std::vector<std::vector<double>> &matrix)
    {
        adjacencyList.clear();
        numVertices = matrix.size();

        for (int i = 0; i < numVertices; i++)
        {
            std::list<Point> neighbors;
            for (int j = 0; j < numVertices; j++)
            {
                if (matrix[i][j] != 0)
                {
                    neighbors.push_back(Point(j, matrix[i][j]));
                }
            }
            adjacencyList[i] = neighbors;
        }
    }

    std::unordered_map<int, std::list<Point>> getAdjacencyList()
    {
        return adjacencyList;
    }

    int getNumVertices()
    {
        return numVertices;
    }

    // Проверка на эйлеровость
    bool isEulerian()
    {
        if (numVertices == 0)
            return false;

        // Проверяем связность (игнорируя вершины степени 0)
        if (!isConnectedIgnoringIsolated())
            return false;

        // Считаем степени вершин
        std::vector<int> degrees(numVertices, 0);
        for (int i = 0; i < numVertices; i++)
        {
            degrees[i] = adjacencyList[i].size();
        }

        // Для неориентированного графа все степени должны быть четными
        int oddCount = 0;
        for (int i = 0; i < numVertices; i++)
        {
            if (degrees[i] % 2 != 0)
            {
                oddCount++;
            }
        }

        return (oddCount == 0);
    }

    // Проверка связности, игнорируя изолированные вершины
    bool isConnectedIgnoringIsolated()
    {
        std::vector<bool> visited(numVertices, false);

        // Находим первую вершину с ненулевой степенью
        int startVertex = -1;
        for (int i = 0; i < numVertices; i++)
        {
            if (adjacencyList[i].size() > 0)
            {
                startVertex = i;
                break;
            }
        }

        if (startVertex == -1)
            return true; // Все вершины изолированы

        // DFS от этой вершины
        std::stack<int> st;
        st.push(startVertex);
        visited[startVertex] = true;

        while (!st.empty())
        {
            int v = st.top();
            st.pop();

            for (const auto &neighbor : adjacencyList[v])
            {
                if (!visited[neighbor.vertex])
                {
                    visited[neighbor.vertex] = true;
                    st.push(neighbor.vertex);
                }
            }
        }

        // Проверяем, что все вершины с ненулевой степенью посещены
        for (int i = 0; i < numVertices; i++)
        {
            if (adjacencyList[i].size() > 0 && !visited[i])
            {
                return false;
            }
        }

        return true;
    }

    // Поиск эйлерова цикла (алгоритм Флёри)
    std::vector<int> findEulerianCycle()
    {
        std::vector<int> cycle;

        if (!isEulerian())
            return cycle;
        if (numVertices == 0)
            return cycle;

        // Копируем граф для модификации
        std::vector<std::vector<double>> tempMatrix(numVertices, std::vector<double>(numVertices, 0));
        for (int i = 0; i < numVertices; i++)
        {
            for (const auto &neighbor : adjacencyList[i])
            {
                tempMatrix[i][neighbor.vertex] = neighbor.weight;
            }
        }

        // Находим начальную вершину (с ненулевой степенью)
        int startVertex = 0;
        for (int i = 0; i < numVertices; i++)
        {
            if (adjacencyList[i].size() > 0)
            {
                startVertex = i;
                break;
            }
        }

        std::stack<int> st;
        st.push(startVertex);

        while (!st.empty())
        {
            int v = st.top();

            // Ищем соседа
            int neighbor = -1;
            for (int i = 0; i < numVertices; i++)
            {
                if (tempMatrix[v][i] != 0)
                {
                    neighbor = i;
                    break;
                }
            }

            if (neighbor != -1)
            {
                // Удаляем ребро
                tempMatrix[v][neighbor] = 0;
                tempMatrix[neighbor][v] = 0;
                st.push(neighbor);
            }
            else
            {
                cycle.push_back(v);
                st.pop();
            }
        }

        return cycle;
    }

    // Венгерский алгоритм для задачи о назначениях
    struct Assignment
    {
        std::vector<int> assignment; // assignment[i] = j означает, что работник i назначен на работу j
        double cost;
    };

    Assignment hungarianAlgorithm()
    {
        Assignment result;

        if (numVertices == 0)
            return result;

        int n = numVertices;

        // Находим максимальный вес для штрафа
        double maxWeight = 0;
        for (int i = 0; i < n; i++)
        {
            for (int j = 0; j < n; j++)
            {
                // Проверяем все пары, даже с нулевым весом
                bool hasEdge = false;
                for (const auto &neighbor : adjacencyList[i])
                {
                    if (neighbor.vertex == j)
                    {
                        maxWeight = std::max(maxWeight, neighbor.weight);
                        hasEdge = true;
                        break;
                    }
                }
            }
        }

        double penalty = (maxWeight + 1) * 100;

        // Строим матрицу стоимостей (включая нулевые)
        std::vector<std::vector<double>> costMatrix(n, std::vector<double>(n, penalty));

        for (int i = 0; i < n; i++)
        {
            for (const auto &neighbor : adjacencyList[i])
            {
                costMatrix[i][neighbor.vertex] = neighbor.weight; // 0 тоже сохраняется
            }
        }

        // Для задачи о назначениях матрица должна быть полной
        // Заполняем диагональ и отсутствующие ребра штрафом

        // Венгерский алгоритм
        std::vector<double> u(n + 1, 0), v(n + 1, 0);
        std::vector<int> p(n + 1, 0), way(n + 1, 0);

        for (int i = 1; i <= n; i++)
        {
            p[0] = i;
            int j0 = 0;
            std::vector<double> minv(n + 1, penalty);
            std::vector<bool> used(n + 1, false);

            do
            {
                used[j0] = true;
                int i0 = p[j0], j1 = 0;
                double delta = penalty;

                for (int j = 1; j <= n; j++)
                {
                    if (!used[j])
                    {
                        double cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
                        if (cur < minv[j])
                        {
                            minv[j] = cur;
                            way[j] = j0;
                        }
                        if (minv[j] < delta)
                        {
                            delta = minv[j];
                            j1 = j;
                        }
                    }
                }

                for (int j = 0; j <= n; j++)
                {
                    if (used[j])
                    {
                        u[p[j]] += delta;
                        v[j] -= delta;
                    }
                    else
                    {
                        minv[j] -= delta;
                    }
                }

                j0 = j1;
            } while (p[j0] != 0);

            do
            {
                int j1 = way[j0];
                p[j0] = p[j1];
                j0 = j1;
            } while (j0 != 0);
        }

        // Формируем результат
        result.assignment.resize(n);
        for (int j = 1; j <= n; j++)
        {
            if (p[j] != 0)
            {
                result.assignment[p[j] - 1] = j - 1;
            }
        }

        // Вычисляем общую стоимость
        result.cost = 0;
        for (int i = 0; i < n; i++)
        {
            result.cost += costMatrix[i][result.assignment[i]];
        }

        return result;
    }

    // Задача коммивояжера (метод ветвей и границ)
    struct TSPResult
    {
        std::vector<int> path;
        double cost;
    };

    TSPResult solveTSP()
    {
        TSPResult result;
        result.cost = std::numeric_limits<double>::infinity();

        if (numVertices < 2)
            return result;

        // Строим полную матрицу
        std::vector<std::vector<double>> costMatrix(numVertices, std::vector<double>(numVertices, std::numeric_limits<double>::infinity()));

        for (int i = 0; i < numVertices; i++)
        {
            for (const auto &neighbor : adjacencyList[i])
            {
                costMatrix[i][neighbor.vertex] = neighbor.weight;
            }
            costMatrix[i][i] = 0;
        }

        // Для вершин без прямого пути используем Floyd-Warshall для нахождения кратчайших путей
        for (int k = 0; k < numVertices; k++)
        {
            for (int i = 0; i < numVertices; i++)
            {
                for (int j = 0; j < numVertices; j++)
                {
                    if (costMatrix[i][k] != std::numeric_limits<double>::infinity() &&
                        costMatrix[k][j] != std::numeric_limits<double>::infinity())
                    {
                        costMatrix[i][j] = std::min(costMatrix[i][j], costMatrix[i][k] + costMatrix[k][j]);
                    }
                }
            }
        }

        // Ветви и границы
        std::vector<int> currentPath = {0};
        std::vector<bool> visited(numVertices, false);
        visited[0] = true;

        tspBranchAndBound(costMatrix, currentPath, visited, 0, 0, result);

        return result;
    }

private:
    void tspBranchAndBound(const std::vector<std::vector<double>> &costMatrix,
                           std::vector<int> &currentPath,
                           std::vector<bool> &visited,
                           int currentVertex,
                           double currentCost,
                           TSPResult &bestResult)
    {

        if (currentPath.size() == numVertices)
        {
            // Замыкаем цикл
            double totalCost = currentCost + costMatrix[currentVertex][0];
            if (totalCost < bestResult.cost)
            {
                bestResult.cost = totalCost;
                bestResult.path = currentPath;
                bestResult.path.push_back(0); // Возвращаемся в начало
            }
            return;
        }

        // Нижняя граница
        double lowerBound = currentCost + calculateLowerBound(costMatrix, currentPath, visited);
        if (lowerBound >= bestResult.cost)
            return;

        for (int nextVertex = 0; nextVertex < numVertices; nextVertex++)
        {
            if (!visited[nextVertex] && costMatrix[currentVertex][nextVertex] != std::numeric_limits<double>::infinity())
            {
                visited[nextVertex] = true;
                currentPath.push_back(nextVertex);

                tspBranchAndBound(costMatrix, currentPath, visited, nextVertex,
                                  currentCost + costMatrix[currentVertex][nextVertex], bestResult);

                currentPath.pop_back();
                visited[nextVertex] = false;
            }
        }
    }

    double calculateLowerBound(const std::vector<std::vector<double>> &costMatrix,
                               const std::vector<int> &currentPath,
                               const std::vector<bool> &visited)
    {
        double bound = 0;

        // Для каждой непосещенной вершины добавляем минимальное ребро
        for (int i = 0; i < numVertices; i++)
        {
            if (!visited[i] || i == currentPath.back())
            {
                double minEdge = std::numeric_limits<double>::infinity();
                for (int j = 0; j < numVertices; j++)
                {
                    if (!visited[j] || j == currentPath[0])
                    {
                        minEdge = std::min(minEdge, costMatrix[i][j]);
                    }
                }
                if (minEdge != std::numeric_limits<double>::infinity())
                {
                    bound += minEdge;
                }
            }
        }

        return bound / 2;
    }

public:
    // BFS обход
    std::vector<int> BFS(int startVertex)
    {
        std::vector<int> result;
        if (startVertex < 0 || startVertex >= numVertices)
            return result;

        std::vector<bool> visited(numVertices, false);
        std::queue<int> q;

        visited[startVertex] = true;
        q.push(startVertex);

        while (!q.empty())
        {
            int current = q.front();
            q.pop();
            result.push_back(current);

            for (const auto &neighbor : adjacencyList[current])
            {
                if (!visited[neighbor.vertex])
                {
                    visited[neighbor.vertex] = true;
                    q.push(neighbor.vertex);
                }
            }
        }

        return result;
    }

    // DFS обход
    std::vector<int> DFS(int startVertex)
    {
        std::vector<int> result;
        if (startVertex < 0 || startVertex >= numVertices)
            return result;

        std::vector<bool> visited(numVertices, false);
        DFSUtil(startVertex, visited, result);

        return result;
    }

    void DFSUtil(int vertex, std::vector<bool> &visited, std::vector<int> &result)
    {
        visited[vertex] = true;
        result.push_back(vertex);

        for (const auto &neighbor : adjacencyList[vertex])
        {
            if (!visited[neighbor.vertex])
            {
                DFSUtil(neighbor.vertex, visited, result);
            }
        }
    }

    // Поиск кратчайшего пути (алгоритм Дейкстры): путь и расстояния от start до каждой вершины
    struct DijkstraResult
    {
        std::vector<int> path;
        std::vector<double> distances;
        std::vector<int> parent;
    };

    DijkstraResult dijkstra(int start, int end)
    {
        DijkstraResult out;
        if (start < 0 || start >= numVertices || end < 0 || end >= numVertices)
        {
            out.distances.assign(static_cast<size_t>(std::max(0, numVertices)),
                                 std::numeric_limits<double>::infinity());
            out.parent.assign(static_cast<size_t>(std::max(0, numVertices)), -1);
            return out;
        }

        std::vector<double> dist(numVertices, std::numeric_limits<double>::infinity());
        std::vector<int> parent(numVertices, -1);
        std::vector<bool> visited(numVertices, false);

        dist[start] = 0;

        for (int i = 0; i < numVertices; i++)
        {
            int u = -1;
            double minDist = std::numeric_limits<double>::infinity();

            for (int j = 0; j < numVertices; j++)
            {
                if (!visited[j] && dist[j] < minDist)
                {
                    minDist = dist[j];
                    u = j;
                }
            }

            if (u == -1)
                break;
            visited[u] = true;

            for (const auto &neighbor : adjacencyList[u])
            {
                if (!visited[neighbor.vertex] && dist[u] + neighbor.weight < dist[neighbor.vertex])
                {
                    dist[neighbor.vertex] = dist[u] + neighbor.weight;
                    parent[neighbor.vertex] = u;
                }
            }
        }

        out.distances = std::move(dist);
        out.parent = std::move(parent);

        if (out.parent[static_cast<size_t>(end)] != -1 || start == end)
        {
            for (int v = end; v != -1; v = out.parent[static_cast<size_t>(v)])
            {
                out.path.push_back(v);
            }
            std::reverse(out.path.begin(), out.path.end());
        }

        return out;
    }

    // Проверка связности
    bool isConnected()
    {
        if (numVertices == 0)
            return true;

        std::vector<bool> visited(numVertices, false);
        std::queue<int> q;

        visited[0] = true;
        q.push(0);

        while (!q.empty())
        {
            int current = q.front();
            q.pop();

            for (const auto &neighbor : adjacencyList[current])
            {
                if (!visited[neighbor.vertex])
                {
                    visited[neighbor.vertex] = true;
                    q.push(neighbor.vertex);
                }
            }
        }

        for (bool v : visited)
        {
            if (!v)
                return false;
        }
        return true;
    }

    struct Edge
    {
        int from;
        int to;
        double weight;
    };

    std::vector<Edge> kruskalMST()
    {
        std::vector<Edge> mst;
        if (numVertices == 0)
            return mst;

        // Собираем все ребра
        std::vector<Edge> allEdges;
        for (int i = 0; i < numVertices; i++)
        {
            for (const auto &neighbor : adjacencyList[i])
            {
                if (i < neighbor.vertex)
                {
                    allEdges.push_back({i, neighbor.vertex, neighbor.weight});
                }
            }
        }

        // Сортируем ребра по весу
        std::sort(allEdges.begin(), allEdges.end(),
                  [](const Edge &a, const Edge &b)
                  { return a.weight < b.weight; });

        // Система непересекающихся множеств (DSU)
        std::vector<int> parent(numVertices);
        std::vector<int> rank(numVertices, 0);
        for (int i = 0; i < numVertices; i++)
        {
            parent[i] = i;
        }

        // Находим корень множества (используем std::function для рекурсии)
        std::function<int(int)> find = [&](int x) -> int
        {
            if (parent[x] != x)
            {
                parent[x] = find(parent[x]);
            }
            return parent[x];
        };

        // Объединяем множества
        auto unite = [&](int x, int y) -> bool
        {
            int rootX = find(x);
            int rootY = find(y);

            if (rootX != rootY)
            {
                if (rank[rootX] < rank[rootY])
                {
                    parent[rootX] = rootY;
                }
                else if (rank[rootX] > rank[rootY])
                {
                    parent[rootY] = rootX;
                }
                else
                {
                    parent[rootY] = rootX;
                    rank[rootX]++;
                }
                return true;
            }
            return false;
        };

        // Строим MST
        for (const auto &edge : allEdges)
        {
            if (unite(edge.from, edge.to))
            {
                mst.push_back(edge);
                if (mst.size() == numVertices - 1)
                    break;
            }
        }

        return mst;
    }

    // Алгоритм Прима для построения минимального остовного дерева
    std::vector<Edge> primMST()
    {
        std::vector<Edge> mst;
        if (numVertices == 0)
            return mst;

        std::vector<bool> inMST(numVertices, false);
        std::vector<double> minWeight(numVertices, std::numeric_limits<double>::infinity());
        std::vector<int> parent(numVertices, -1);

        // Начинаем с вершины 0
        minWeight[0] = 0;

        for (int i = 0; i < numVertices; i++)
        {
            // Находим вершину с минимальным весом
            int u = -1;
            double minVal = std::numeric_limits<double>::infinity();

            for (int j = 0; j < numVertices; j++)
            {
                if (!inMST[j] && minWeight[j] < minVal)
                {
                    minVal = minWeight[j];
                    u = j;
                }
            }

            if (u == -1)
                break; // Несвязный граф

            inMST[u] = true;

            // Добавляем ребро в MST (кроме начальной вершины)
            if (parent[u] != -1)
            {
                double weight = 0;
                for (const auto &neighbor : adjacencyList[u])
                {
                    if (neighbor.vertex == parent[u])
                    {
                        weight = neighbor.weight;
                        break;
                    }
                }
                mst.push_back({parent[u], u, weight});
            }

            // Обновляем минимальные веса для соседей
            for (const auto &neighbor : adjacencyList[u])
            {
                if (!inMST[neighbor.vertex] && neighbor.weight < minWeight[neighbor.vertex])
                {
                    minWeight[neighbor.vertex] = neighbor.weight;
                    parent[neighbor.vertex] = u;
                }
            }
        }

        return mst;
    }

    std::vector<std::pair<double, double>> calculateVertexPositions(double centerX, double centerY, double radius)
    {
        std::vector<std::pair<double, double>> positions;

        if (numVertices == 0)
            return positions;

        for (int i = 0; i < numVertices; i++)
        {
            double angle = 2.0 * M_PI * i / numVertices - M_PI / 2.0;
            double x = centerX + radius * cos(angle);
            double y = centerY + radius * sin(angle);
            positions.push_back({x, y});
        }

        return positions;
    }
};

// Синхронная функция построения графа
Napi::Value BuildGraph(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix array").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));

    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);

    double radius = 200.0;
    if (n > 10)
        radius = 200.0 + (n - 10) * 25.0;
    if (n > 20)
        radius = 200.0 + 10 * 25.0 + (n - 20) * 15.0;

    double centerX = 450.0;
    double centerY = 300.0;

    auto positions = graf.calculateVertexPositions(centerX, centerY, radius);
    auto adjList = graf.getAdjacencyList();

    Napi::Object result = Napi::Object::New(env);

    Napi::Array posArray = Napi::Array::New(env, positions.size());
    for (size_t i = 0; i < positions.size(); i++)
    {
        Napi::Object pos = Napi::Object::New(env);
        pos.Set("x", positions[i].first);
        pos.Set("y", positions[i].second);
        posArray.Set(i, pos);
    }
    result.Set("vertices", posArray);

    Napi::Array edgesArray = Napi::Array::New(env);
    int edgeIndex = 0;

    std::vector<std::vector<bool>> processed(n, std::vector<bool>(n, false));

    for (int i = 0; i < n; i++)
    {
        for (int j = 0; j < n; j++)
        {
            if (matrix[i][j] != 0 && !processed[i][j])
            {
                Napi::Object edge = Napi::Object::New(env);

                bool isBidirectional = (matrix[j][i] != 0 && matrix[i][j] == matrix[j][i]);

                edge.Set("from", i);
                edge.Set("to", j);
                edge.Set("weight", matrix[i][j]);
                edge.Set("isBidirectional", isBidirectional);

                if (isBidirectional)
                {
                    processed[i][j] = true;
                    processed[j][i] = true;
                }
                else
                {
                    processed[i][j] = true;
                }

                edgesArray.Set(edgeIndex++, edge);
            }
        }
    }
    result.Set("edges", edgesArray);
    result.Set("numVertices", n);
    result.Set("radius", radius);

    return result;
}

// Проверка на эйлеровость
Napi::Value CheckEulerian(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);

    return Napi::Boolean::New(env, graf.isEulerian());
}

// Поиск эйлерова цикла
Napi::Value FindEulerianCycle(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);

    auto cycle = graf.findEulerianCycle();

    Napi::Array result = Napi::Array::New(env, cycle.size());
    for (size_t i = 0; i < cycle.size(); i++)
    {
        result.Set(i, cycle[i]);
    }

    return result;
}

// Решение задачи коммивояжера
Napi::Value SolveTSP(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);

    auto tspResult = graf.solveTSP();

    Napi::Object result = Napi::Object::New(env);

    Napi::Array pathArray = Napi::Array::New(env, tspResult.path.size());
    for (size_t i = 0; i < tspResult.path.size(); i++)
    {
        pathArray.Set(i, tspResult.path[i]);
    }

    result.Set("path", pathArray);
    result.Set("cost", tspResult.cost);

    return result;
}

// BFS функция
Napi::Value RunBFS(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsNumber())
    {
        Napi::TypeError::New(env, "Expected matrix and start vertex").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int startVertex = info[1].As<Napi::Number>().Int32Value();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);
    auto bfsResult = graf.BFS(startVertex);

    Napi::Array result = Napi::Array::New(env, bfsResult.size());
    for (size_t i = 0; i < bfsResult.size(); i++)
    {
        result.Set(i, bfsResult[i]);
    }

    return result;
}

// DFS функция
Napi::Value RunDFS(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsNumber())
    {
        Napi::TypeError::New(env, "Expected matrix and start vertex").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int startVertex = info[1].As<Napi::Number>().Int32Value();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);
    auto dfsResult = graf.DFS(startVertex);

    Napi::Array result = Napi::Array::New(env, dfsResult.size());
    for (size_t i = 0; i < dfsResult.size(); i++)
    {
        result.Set(i, dfsResult[i]);
    }

    return result;
}

// Кратчайший путь
Napi::Value FindShortestPath(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsArray() || !info[1].IsNumber() || !info[2].IsNumber())
    {
        Napi::TypeError::New(env, "Expected matrix, start and end vertices").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int startVertex = info[1].As<Napi::Number>().Int32Value();
    int endVertex = info[2].As<Napi::Number>().Int32Value();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);
    auto dj = graf.dijkstra(startVertex, endVertex);

    Napi::Object result = Napi::Object::New(env);

    Napi::Array pathArr = Napi::Array::New(env, dj.path.size());
    for (size_t i = 0; i < dj.path.size(); i++)
    {
        pathArr.Set(i, dj.path[i]);
    }
    result.Set("path", pathArr);

    const int nv = graf.getNumVertices();
    Napi::Array distArr = Napi::Array::New(env, nv);
    for (int i = 0; i < nv; i++)
    {
        double d = dj.distances[static_cast<size_t>(i)];
        if (std::isfinite(d))
        {
            distArr.Set(i, Napi::Number::New(env, d));
        }
        else
        {
            distArr.Set(i, env.Null());
        }
    }
    result.Set("vertexDistances", distArr);

    Napi::Array parentArr = Napi::Array::New(env, nv);
    for (int i = 0; i < nv; i++)
    {
        int p = (i < static_cast<int>(dj.parent.size()) ? dj.parent[static_cast<size_t>(i)] : -1);
        if (p < 0)
        {
            parentArr.Set(i, env.Null());
        }
        else
        {
            parentArr.Set(i, p);
        }
    }
    result.Set("vertexParents", parentArr);

    return result;
}

// Проверка связности
Napi::Value CheckConnectivity(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);

    return Napi::Boolean::New(env, graf.isConnected());
}
// Построение MST алгоритмом Краскала
Napi::Value KruskalMST(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);

    auto mst = graf.kruskalMST();

    Napi::Object result = Napi::Object::New(env);

    Napi::Array edgesArray = Napi::Array::New(env, mst.size());
    for (size_t i = 0; i < mst.size(); i++)
    {
        Napi::Object edge = Napi::Object::New(env);
        edge.Set("from", mst[i].from);
        edge.Set("to", mst[i].to);
        edge.Set("weight", mst[i].weight);
        edgesArray.Set(i, edge);
    }

    result.Set("edges", edgesArray);
    result.Set("numVertices", n);

    // Вычисляем общий вес MST
    double totalWeight = 0;
    for (const auto &edge : mst)
    {
        totalWeight += edge.weight;
    }
    result.Set("totalWeight", totalWeight);

    return result;
}

// Венгерский алгоритм
Napi::Value SolveHungarian(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    if (n == 0)
    {
        Napi::TypeError::New(env, "Matrix cannot be empty").ThrowAsJavaScriptException();
        return env.Null();
    }

    bool maximize = false;
    if (info.Length() >= 2 && info[1].IsBoolean())
    {
        maximize = info[1].As<Napi::Boolean>().Value();
    }

    std::vector<std::vector<double>> orig(n, std::vector<double>(n, 0));
    double coeffMax = 0;
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        if (row.Length() != n)
        {
            Napi::TypeError::New(env, "Matrix must be square").ThrowAsJavaScriptException();
            return env.Null();
        }
        for (int j = 0; j < n; j++)
        {
            orig[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
            coeffMax = std::max(coeffMax, orig[i][j]);
        }
    }

    // Минимизация: венгерский на orig. Максимизация суммы orig: минимизируем (coeffMax - orig[i][j])
    std::vector<std::vector<double>> costMatrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        for (int j = 0; j < n; j++)
        {
            costMatrix[i][j] = maximize ? (coeffMax - orig[i][j]) : orig[i][j];
        }
    }

    // Венгерский алгоритм (минимизация по costMatrix)
    std::vector<double> u(n + 1, 0), v(n + 1, 0);
    std::vector<int> p(n + 1, 0), way(n + 1, 0);

    for (int i = 1; i <= n; i++)
    {
        p[0] = i;
        int j0 = 0;
        std::vector<double> minv(n + 1, std::numeric_limits<double>::max());
        std::vector<bool> used(n + 1, false);

        do
        {
            used[j0] = true;
            int i0 = p[j0], j1 = 0;
            double delta = std::numeric_limits<double>::max();

            for (int j = 1; j <= n; j++)
            {
                if (!used[j])
                {
                    double cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j])
                    {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if (minv[j] < delta)
                    {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }

            for (int j = 0; j <= n; j++)
            {
                if (used[j])
                {
                    u[p[j]] += delta;
                    v[j] -= delta;
                }
                else
                {
                    minv[j] -= delta;
                }
            }

            j0 = j1;
        } while (p[j0] != 0);

        do
        {
            int j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0 != 0);
    }

    // Формируем результат
    std::vector<int> assignment(n);
    for (int j = 1; j <= n; j++)
    {
        if (p[j] != 0)
        {
            assignment[p[j] - 1] = j - 1;
        }
    }

    // Сумма по исходной матрице (для max и min одинаково интерпретируем ячейки orig)
    double totalCost = 0;
    for (int i = 0; i < n; i++)
    {
        totalCost += orig[i][assignment[i]];
    }

    Napi::Object result = Napi::Object::New(env);

    Napi::Array assignArray = Napi::Array::New(env, assignment.size());
    for (size_t i = 0; i < assignment.size(); i++)
    {
        assignArray.Set(i, assignment[i]);
    }

    result.Set("assignment", assignArray);
    result.Set("cost", totalCost);
    result.Set("maximize", Napi::Boolean::New(env, maximize));
    result.Set("numVertices", n);

    return result;
}

// Построение MST алгоритмом Прима
Napi::Value PrimMST(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected adjacency matrix").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array matrixArray = info[0].As<Napi::Array>();
    int n = matrixArray.Length();

    std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0));
    for (int i = 0; i < n; i++)
    {
        Napi::Array row = matrixArray.Get(i).As<Napi::Array>();
        for (int j = 0; j < n; j++)
        {
            matrix[i][j] = row.Get(j).As<Napi::Number>().DoubleValue();
        }
    }

    GRAF graf;
    graf.buildFromMatrix(matrix);

    auto mst = graf.primMST();

    Napi::Object result = Napi::Object::New(env);

    Napi::Array edgesArray = Napi::Array::New(env, mst.size());
    for (size_t i = 0; i < mst.size(); i++)
    {
        Napi::Object edge = Napi::Object::New(env);
        edge.Set("from", mst[i].from);
        edge.Set("to", mst[i].to);
        edge.Set("weight", mst[i].weight);
        edgesArray.Set(i, edge);
    }

    result.Set("edges", edgesArray);
    result.Set("numVertices", n);

    double totalWeight = 0;
    for (const auto &edge : mst)
    {
        totalWeight += edge.weight;
    }
    result.Set("totalWeight", totalWeight);

    return result;
}

// Регистрация функций
Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set("buildGraph", Napi::Function::New(env, BuildGraph));
    exports.Set("bfs", Napi::Function::New(env, RunBFS));
    exports.Set("dfs", Napi::Function::New(env, RunDFS));
    exports.Set("shortestPath", Napi::Function::New(env, FindShortestPath));
    exports.Set("isConnected", Napi::Function::New(env, CheckConnectivity));
    exports.Set("isEulerian", Napi::Function::New(env, CheckEulerian));
    exports.Set("findEulerianCycle", Napi::Function::New(env, FindEulerianCycle));
    exports.Set("solveTSP", Napi::Function::New(env, SolveTSP));
    exports.Set("kruskalMST", Napi::Function::New(env, KruskalMST));
    exports.Set("primMST", Napi::Function::New(env, PrimMST));
    exports.Set("solveHungarian", Napi::Function::New(env, SolveHungarian)); // <-- Должна быть эта строка
    return exports;
}

NODE_API_MODULE(grafalgorithms, Init)
