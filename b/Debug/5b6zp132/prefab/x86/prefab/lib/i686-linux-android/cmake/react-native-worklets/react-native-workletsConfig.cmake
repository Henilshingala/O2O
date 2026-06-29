if(NOT TARGET react-native-worklets::worklets)
add_library(react-native-worklets::worklets SHARED IMPORTED)
set_target_properties(react-native-worklets::worklets PROPERTIES
    IMPORTED_LOCATION "D:/downloads/020/o2o/o2o/artifacts/o2o/node_modules/react-native-worklets/android/build/intermediates/cxx/Debug/605u2a1h/obj/x86/libworklets.so"
    INTERFACE_INCLUDE_DIRECTORIES "D:/downloads/020/o2o/o2o/artifacts/o2o/node_modules/react-native-worklets/android/build/prefab-headers/worklets"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

