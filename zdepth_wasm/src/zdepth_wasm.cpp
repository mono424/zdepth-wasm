#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "zdepth.hpp"

using namespace emscripten;

struct DecompressionResult
{
    zdepth::DepthResult result;
    int width;
    int height;
    std::vector<uint16_t> depth_data;
};

struct CompressionResult
{
    zdepth::DepthResult result;
    std::vector<uint8_t> compressed_data;
};

DecompressionResult decompress_wrapper(
    zdepth::DepthCompressor &self,
    const std::vector<uint8_t> &compressed_data)
{

    int width = 0;
    int height = 0;
    std::vector<uint16_t> depth_out;

    zdepth::DepthResult res = self.Decompress(compressed_data, width, height, depth_out);

    return {res, width, height, depth_out};
}

CompressionResult compress_wrapper(
    zdepth::DepthCompressor &self,
    int width,
    int height,
    const std::vector<uint16_t> &unquantized_depth,
    bool keyframe)
{
    std::vector<uint8_t> compressed_data;
    zdepth::DepthResult res = self.Compress(width, height, unquantized_depth.data(), compressed_data, keyframe);
    return {res, compressed_data};
}

EMSCRIPTEN_BINDINGS(zdepth_module)
{
    class_<zdepth::DepthCompressor>("DepthCompressor")
        .constructor<>()
        .function("compress", &compress_wrapper, allow_raw_pointers())
        .function("decompress", &decompress_wrapper);

    value_object<DecompressionResult>("DecompressionResult")
        .field("result", &DecompressionResult::result)
        .field("width", &DecompressionResult::width)
        .field("height", &DecompressionResult::height)
        .field("depth_data", &DecompressionResult::depth_data);

    value_object<CompressionResult>("CompressionResult")
        .field("result", &CompressionResult::result)
        .field("compressed_data", &CompressionResult::compressed_data);

    enum_<zdepth::DepthResult>("DepthResult")
        .value("FileTruncated", zdepth::DepthResult::FileTruncated)
        .value("WrongFormat", zdepth::DepthResult::WrongFormat)
        .value("Corrupted", zdepth::DepthResult::Corrupted)
        .value("MissingPFrame", zdepth::DepthResult::MissingPFrame)
        .value("BadDimensions", zdepth::DepthResult::BadDimensions)
        .value("Success", zdepth::DepthResult::Success);

    register_vector<uint8_t>("VectorUint8");
    register_vector<uint16_t>("VectorUint16");
}
