// addon/src/grafalgorithms.cpp
#include <napi.h>
#include <cmath>
#include <vector>
#include <unordered_map>
#include <list>
#include <algorithm>
#include <queue>
#include <limits>

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

    // Вычисление позиций вершин для визуализации (по кругу)
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

        // Восстанавливаем путь
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

    // Проверка связности графа
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

    auto positions = graf.calculateVertexPositions(450.0, 300.0, 200.0);
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

    for (int i = 0; i < n; i++)
    {
        for (const auto &point : adjList[i])
        {
            if (i < point.vertex)
            {
                Napi::Object edge = Napi::Object::New(env);
                edge.Set("from", i);
                edge.Set("to", point.vertex);
                edge.Set("weight", point.weight);
                edgesArray.Set(edgeIndex++, edge);
            }
        }
    }
    result.Set("edges", edgesArray);
    result.Set("numVertices", n);

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
    return exports;
}

NODE_API_MODULE(grafalgorithms, Init)