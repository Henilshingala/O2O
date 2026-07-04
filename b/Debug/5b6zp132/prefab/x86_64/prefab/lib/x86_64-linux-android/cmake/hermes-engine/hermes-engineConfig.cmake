if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/Drashti/.gradle/caches/8.14.3/transforms/7cf4a42ed1e9c4328acd062300cf3c40/transformed/hermes-android-0.81.5-debug/prefab/modules/libhermes/libs/android.x86_64/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/Drashti/.gradle/caches/8.14.3/transforms/7cf4a42ed1e9c4328acd062300cf3c40/transformed/hermes-android-0.81.5-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

