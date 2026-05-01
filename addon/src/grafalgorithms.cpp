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

    // Поиск кратчайшего пути (алгоритм Дейкстры)
    std::vector<int> dijkstra(int start, int end)
    {
        std::vector<int> path;
        if (start < 0 || start >= numVertices || end < 0 || end >= numVertices)
            return path;

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

        if (parent[end] != -1 || start == end)
        {
            for (int v = end; v != -1; v = parent[v])
            {
                path.push_back(v);
            }
            std::reverse(path.begin(), path.end());
        }

        return path;
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
    auto path = graf.dijkstra(startVertex, endVertex);

    Napi::Array result = Napi::Array::New(env, path.size());
    for (size_t i = 0; i < path.size(); i++)
    {
        result.Set(i, path[i]);
    }

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
    return exports;
}

NODE_API_MODULE(grafalgorithms, Init)