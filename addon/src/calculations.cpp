#include <napi.h>
#include <cmath>
#include <vector>

// Обычная C++ функция
double heavyCalculation(double x)
{
    double result = 0;
    for (int i = 0; i < 1000000; i++)
    {
        result += std::sin(x * i) * std::cos(x / (i + 1));
    }
    return result;
}

// Обёртка для Node.js — синхронный вызов
Napi::Value Calculate(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber())
    {
        Napi::TypeError::New(env, "Нужно передать число").ThrowAsJavaScriptException();
        return env.Null();
    }

    double input = info[0].As<Napi::Number>().DoubleValue();
    double result = heavyCalculation(input);

    return Napi::Number::New(env, result);
}

// Асинхронный вызов (не блокирует UI)
class CalcWorker : public Napi::AsyncWorker
{
public:
    CalcWorker(Napi::Function &callback, double input)
        : Napi::AsyncWorker(callback), input(input) {}

    void Execute() override
    {
        result = heavyCalculation(input);
    }

    void OnOK() override
    {
        Napi::HandleScope scope(Env());
        Callback().Call({Env().Null(), Napi::Number::New(Env(), result)});
    }

private:
    double input, result;
};

Napi::Value CalculateAsync(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    double input = info[0].As<Napi::Number>().DoubleValue();
    Napi::Function callback = info[1].As<Napi::Function>();

    CalcWorker *worker = new CalcWorker(callback, input);
    worker->Queue();
    return env.Undefined();
}

// Регистрация функций
Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set("calculate", Napi::Function::New(env, Calculate));
    exports.Set("calculateAsync", Napi::Function::New(env, CalculateAsync));
    return exports;
}

NODE_API_MODULE(calculations, Init)