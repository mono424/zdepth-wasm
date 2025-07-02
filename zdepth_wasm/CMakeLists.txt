cmake_minimum_required(VERSION 3.5)
project(zdepth_wasm_module LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 11)

# Find Zdepth library
set(zdepth_DIR "${CMAKE_SOURCE_DIR}/../Zdepth/install/lib/cmake/zdepth")
find_package(zdepth CONFIG REQUIRED)

# Source files for the WASM module
set(SOURCE_FILES
    src/zdepth_wasm.cpp
)

# Emscripten specific flags
if(EMSCRIPTEN)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME='ZdepthModule'")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME='ZdepthModule' -lembind")
endif()

include_directories(${zdepth_INCLUDE_DIRS})

add_executable(zdepth_wasm ${SOURCE_FILES})

target_link_libraries(zdepth_wasm PUBLIC zdepth::zdepth)
